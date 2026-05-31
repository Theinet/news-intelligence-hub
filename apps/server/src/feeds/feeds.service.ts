import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {Feed, Prisma} from '@prisma/client';
import Parser from 'rss-parser';
import {PrismaService} from '../common/prisma.service';
import {QueuesService} from '../jobs/queues.service';

interface FeedCandidate {
  url: URL;
  title: string;
}

@Injectable()
export class FeedsService {
  private readonly parser = new Parser();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService
  ) {}

  list(userId: string) {
    return this.prisma.feed.findMany({where: {userId}, orderBy: {createdAt: 'desc'}});
  }

  async create(userId: string, url: string) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('Only HTTP(S) feeds are supported');
    }
    const candidate = await this.resolveFeed(parsedUrl);
    const title = candidate.title || candidate.url.hostname;
    let record: Feed;
    try {
      record = await this.prisma.feed.create({
        data: {userId, url: candidate.url.toString(), title}
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Feed already exists');
      }
      throw error;
    }
    await this.queues.feedPull.add('feed.pull', {userId, feedId: record.id});
    return {...record, discoveredFrom: candidate.url.toString() === parsedUrl.toString() ? null : parsedUrl.toString()};
  }

  async pause(userId: string, feedId: string) {
    await this.ensureFeed(userId, feedId);
    return this.prisma.feed.update({where: {id: feedId}, data: {status: 'paused'}});
  }

  async resume(userId: string, feedId: string) {
    await this.ensureFeed(userId, feedId);
    const feed = await this.prisma.feed.update({
      where: {id: feedId},
      data: {status: 'active', lastError: null}
    });
    await this.queues.feedPull.add('feed.pull', {userId, feedId});
    return feed;
  }

  async remove(userId: string, feedId: string): Promise<void> {
    await this.ensureFeed(userId, feedId);
    await this.prisma.feed.delete({where: {id: feedId}});
  }

  async pullNow(userId: string, feedId: string): Promise<{queued: true}> {
    await this.ensureFeed(userId, feedId);
    await this.queues.feedPull.add('feed.pull.manual', {userId, feedId});
    return {queued: true};
  }

  private async ensureFeed(userId: string, feedId: string): Promise<void> {
    const feed = await this.prisma.feed.findFirst({where: {id: feedId, userId}});
    if (!feed) {
      throw new NotFoundException('Feed not found');
    }
  }

  private async resolveFeed(url: URL): Promise<FeedCandidate> {
    const direct = await this.tryParseFeed(url);
    if (direct) {
      return direct;
    }
    const discoveredUrls = await this.discoverFeedUrls(url);
    for (const discoveredUrl of discoveredUrls) {
      const candidate = await this.tryParseFeed(discoveredUrl);
      if (candidate) {
        return candidate;
      }
    }
    throw new BadRequestException('URL is not a reachable RSS/Atom feed and no feed link was discovered');
  }

  private async tryParseFeed(url: URL): Promise<FeedCandidate | null> {
    try {
      const feed = await this.parser.parseURL(url.toString());
      if (!feed.items || feed.items.length === 0) {
        return null;
      }
      return {url, title: feed.title ?? url.hostname};
    } catch {
      return null;
    }
  }

  private async discoverFeedUrls(pageUrl: URL): Promise<URL[]> {
    try {
      const response = await fetch(pageUrl.toString(), {
        headers: {accept: 'text/html,application/xhtml+xml'}
      });
      if (!response.ok) {
        return [];
      }
      const html = await response.text();
      return this.rankDiscoveredLinks(pageUrl, extractFeedLinks(html, pageUrl));
    } catch {
      return [];
    }
  }

  private rankDiscoveredLinks(pageUrl: URL, urls: URL[]): URL[] {
    const pagePath = pageUrl.pathname.replace(/\/$/, '');
    return urls
      .filter((url, index, all) => all.findIndex((item) => item.toString() === url.toString()) === index)
      .sort((left, right) => scoreFeedUrl(right, pagePath) - scoreFeedUrl(left, pagePath));
  }
}

export function extractFeedLinks(html: string, baseUrl: URL): URL[] {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  return links.flatMap((link) => {
    const rel = readAttribute(link, 'rel')?.toLowerCase() ?? '';
    const type = readAttribute(link, 'type')?.toLowerCase() ?? '';
    const href = readAttribute(link, 'href');
    if (!href || !rel.includes('alternate') || !/(rss|atom)\+xml/.test(type)) {
      return [];
    }
    try {
      return [new URL(href, baseUrl)];
    } catch {
      return [];
    }
  });
}

function readAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1];
}

function scoreFeedUrl(url: URL, pagePath: string): number {
  let score = 0;
  const path = url.pathname.replace(/\/$/, '');
  if (pagePath && path.startsWith(pagePath)) {
    score += 10;
  }
  if (!path.includes('comments')) {
    score += 5;
  }
  if (path.endsWith('/feed')) {
    score += 2;
  }
  return score;
}
