import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {Feed, Prisma} from '@prisma/client';
import Parser from 'rss-parser';
import {PrismaService} from '../common/prisma.service';
import {QueuesService} from '../jobs/queues.service';

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
    let title = parsedUrl.hostname;
    try {
      const feed = await this.parser.parseURL(parsedUrl.toString());
      title = feed.title ?? title;
      if (!feed.items || feed.items.length === 0) {
        throw new Error('Feed has no items');
      }
    } catch (error) {
      throw new BadRequestException(
        `URL is not a reachable RSS/Atom feed: ${error instanceof Error ? error.message : error}`
      );
    }
    let record: Feed;
    try {
      record = await this.prisma.feed.create({
        data: {userId, url: parsedUrl.toString(), title}
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Feed already exists');
      }
      throw error;
    }
    await this.queues.feedPull.add('feed.pull', {userId, feedId: record.id});
    return record;
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
}
