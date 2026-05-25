import {Injectable, OnModuleDestroy} from '@nestjs/common';
import {Queue} from 'bullmq';
import IORedis from 'ioredis';
import {
  ArticleProcessJob,
  DigestJob,
  FeedPullJob,
  queueNames,
  RegenerationJob
} from './queue-names';

@Injectable()
export class QueuesService implements OnModuleDestroy {
  readonly connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null
  });

  readonly feedPull = new Queue<FeedPullJob>(queueNames.feedPull, {connection: this.connection});
  readonly articleProcess = new Queue<ArticleProcessJob>(queueNames.articleProcess, {
    connection: this.connection
  });
  readonly regeneration = new Queue<RegenerationJob>(queueNames.regeneration, {
    connection: this.connection
  });
  readonly digest = new Queue<DigestJob>(queueNames.digest, {connection: this.connection});

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.feedPull.close(),
      this.articleProcess.close(),
      this.regeneration.close(),
      this.digest.close(),
      this.connection.quit()
    ]);
  }
}
