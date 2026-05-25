import {Controller, Get, Param, Query, UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CurrentUser} from '../auth/current-user';
import {ArticlesService} from './articles.service';

@UseGuards(AuthGuard)
@Controller()
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get('articles')
  list(
    @CurrentUser() user: CurrentUser,
    @Query() query: {
      category?: string;
      feedId?: string;
      importance?: string;
      status?: string;
      from?: string;
      to?: string;
    }
  ) {
    return this.articles.list(user.id, query);
  }

  @Get('articles/:id')
  get(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.articles.get(user.id, id);
  }

  @Get('entities/:id')
  entity(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.articles.entity(user.id, id);
  }
}
