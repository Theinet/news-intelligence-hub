import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CurrentUser} from '../auth/current-user';
import {FeedsService} from './feeds.service';

@UseGuards(AuthGuard)
@Controller('feeds')
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUser) {
    return this.feeds.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() body: {url: string}) {
    return this.feeds.create(user.id, body.url);
  }

  @Patch(':id/pause')
  pause(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.feeds.pause(user.id, id);
  }

  @Patch(':id/resume')
  resume(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.feeds.resume(user.id, id);
  }

  @Post(':id/pull')
  pullNow(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.feeds.pullNow(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.feeds.remove(user.id, id);
  }
}
