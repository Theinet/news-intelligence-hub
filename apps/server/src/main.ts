import {BullMQAdapter} from '@bull-board/api/bullMQAdapter';
import {createBullBoard} from '@bull-board/api';
import {ExpressAdapter} from '@bull-board/express';
import {NestFactory} from '@nestjs/core';
import basicAuth from 'express-basic-auth';
import {AppModule} from './app.module';
import {envNumber} from './common/env';
import {QueuesService} from './jobs/queues.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {cors: true});
  app.enableCors({origin: true, credentials: true});
  const queues = app.get(QueuesService);
  const boardAdapter = new ExpressAdapter();
  boardAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [
      new BullMQAdapter(queues.feedPull),
      new BullMQAdapter(queues.articleProcess),
      new BullMQAdapter(queues.regeneration),
      new BullMQAdapter(queues.digest)
    ],
    serverAdapter: boardAdapter
  });
  app.use('/admin/queues', basicAuth({
    users: {
      [process.env.BULL_BOARD_USER ?? 'admin']: process.env.BULL_BOARD_PASSWORD ?? 'change-me'
    },
    challenge: true
  }), boardAdapter.getRouter());
  await app.listen(envNumber('API_PORT', 3000));
  console.log(JSON.stringify({level: 'info', event: 'api.started', port: envNumber('API_PORT', 3000)}));
}

void bootstrap();
