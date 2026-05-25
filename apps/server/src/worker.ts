import {NestFactory} from '@nestjs/core';
import {Worker} from 'bullmq';
import {AppModule} from './app.module';
import {envNumber} from './common/env';
import {ArticleProcessorService} from './jobs/article-processor.service';
import {DigestBuilderService} from './jobs/digest-builder.service';
import {FeedPullerService} from './jobs/feed-puller.service';
import {
  ArticleProcessJob,
  DigestJob,
  FeedPullJob,
  queueNames,
  RegenerationJob
} from './jobs/queue-names';
import {QueuesService} from './jobs/queues.service';
import {PrismaService} from './common/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  const queues = app.get(QueuesService);
  const prisma = app.get(PrismaService);
  const feedPuller = app.get(FeedPullerService);
  const processor = app.get(ArticleProcessorService);
  const digestBuilder = app.get(DigestBuilderService);
  const workers = [
    new Worker<FeedPullJob>(queueNames.feedPull, async (job) => {
      await feedPuller.pull(job.data.userId, job.data.feedId);
    }, {connection: queues.connection, concurrency: 2}),
    new Worker<ArticleProcessJob>(queueNames.articleProcess, async (job) => {
      await processor.process(job.data.userId, job.data.articleId, job.data.regenerationId);
    }, {connection: queues.connection, concurrency: envNumber('LLM_CONCURRENCY', 2)}),
    new Worker<RegenerationJob>(queueNames.regeneration, async (job) => {
      await prisma.regenerationRun.update({
        where: {id: job.data.regenerationId},
        data: {status: 'running'}
      });
      const articles = await prisma.article.findMany({
        where: {userId: job.data.userId, status: 'processed'},
        select: {id: true}
      });
      for (const article of articles) {
        await queues.articleProcess.add('article.regenerate', {
          userId: job.data.userId,
          articleId: article.id,
          regenerationId: job.data.regenerationId
        });
      }
    }, {connection: queues.connection, concurrency: 1}),
    new Worker<DigestJob>(queueNames.digest, async (job) => {
      await digestBuilder.build(job.data.userId, job.data.digestId);
    }, {connection: queues.connection, concurrency: 1})
  ];
  for (const worker of workers) {
    worker.on('failed', (job, error) => {
      console.error(JSON.stringify({
        level: 'error',
        event: 'queue.job_failed',
        queue: worker.name,
        jobId: job?.id,
        message: error.message
      }));
    });
  }
  console.log(JSON.stringify({level: 'info', event: 'worker.started'}));
}

void bootstrap();
