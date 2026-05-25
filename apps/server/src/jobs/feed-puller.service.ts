import {Injectable} from '@nestjs/common';
import Parser from 'rss-parser';
import {sha256, normalizeUrl} from '../common/hash';
import {PrismaService} from '../common/prisma.service';
import {stripHtml} from '../common/text';
import {QueuesService} from './queues.service';

@Injectable()
export class FeedPullerService {
  private readonly parser = new Parser();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService
  ) {}

  async pull(userId: string, feedId: string): Promise<void> {
    const feed = await this.prisma.feed.findFirst({where: {id: feedId, userId}});
    if (!feed || feed.status === 'paused') {
      return;
    }
    try {
      const parsed = await this.parser.parseURL(feed.url);
      await this.prisma.feed.update({
        where: {id: feed.id},
        data: {title: parsed.title ?? feed.title, status: 'active', lastError: null, lastPulledAt: new Date()}
      });
      for (const item of parsed.items.slice(0, 25)) {
        const url = item.link ?? item.guid;
        if (!url) {
          continue;
        }
        const content = stripHtml(
          item.content ?? item['content:encoded'] as string | undefined ?? item.contentSnippet ?? item.title ?? ''
        );
        const article = await this.prisma.article.upsert({
          where: {userId_normalizedUrl: {userId, normalizedUrl: normalizeUrl(url)}},
          create: {
            userId,
            feedId: feed.id,
            title: item.title ?? 'Untitled article',
            url,
            normalizedUrl: normalizeUrl(url),
            author: item.creator ?? item.author,
            publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
            content,
            contentHash: sha256(content)
          },
          update: {feedId: feed.id}
        });
        if (article.status === 'pending') {
          await this.queues.articleProcess.add('article.process', {userId, articleId: article.id});
        }
      }
      console.log(JSON.stringify({level: 'info', event: 'feed.pulled', userId, feedId}));
    } catch (error) {
      await this.prisma.feed.update({
        where: {id: feed.id},
        data: {
          status: 'error',
          lastError: error instanceof Error ? error.message : String(error)
        }
      });
      console.error(JSON.stringify({
        level: 'error',
        event: 'feed.pull_failed',
        userId,
        feedId,
        message: error instanceof Error ? error.message : String(error)
      }));
    }
  }
}
