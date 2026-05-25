import {Module} from '@nestjs/common';
import {JwtModule} from '@nestjs/jwt';
import {StringValue} from 'ms';
import {ArticlesController} from './articles/articles.controller';
import {ArticlesService} from './articles/articles.service';
import {AuthController} from './auth/auth.controller';
import {AuthGuard} from './auth/auth.guard';
import {AuthService} from './auth/auth.service';
import {PrismaService} from './common/prisma.service';
import {DigestsController} from './digests/digests.controller';
import {DigestsService} from './digests/digests.service';
import {FeedsController} from './feeds/feeds.controller';
import {FeedsService} from './feeds/feeds.service';
import {GraphController} from './graph/graph.controller';
import {GraphService} from './graph/graph.service';
import {ArticleProcessorService} from './jobs/article-processor.service';
import {DigestBuilderService} from './jobs/digest-builder.service';
import {FeedPullerService} from './jobs/feed-puller.service';
import {QueuesService} from './jobs/queues.service';
import {LlmService} from './llm/llm.service';
import {SettingsController} from './settings/settings.controller';
import {SettingsService} from './settings/settings.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: {expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as StringValue}
    })
  ],
  controllers: [
    AuthController,
    FeedsController,
    SettingsController,
    ArticlesController,
    GraphController,
    DigestsController
  ],
  providers: [
    PrismaService,
    QueuesService,
    AuthGuard,
    AuthService,
    FeedsService,
    SettingsService,
    ArticlesService,
    GraphService,
    DigestsService,
    LlmService,
    ArticleProcessorService,
    FeedPullerService,
    DigestBuilderService
  ]
})
export class AppModule {}
