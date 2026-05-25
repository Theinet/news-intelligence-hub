import {Body, Controller, Get, Param, Post, UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CurrentUser} from '../auth/current-user';
import {DigestsService} from './digests.service';

@UseGuards(AuthGuard)
@Controller()
export class DigestsController {
  constructor(private readonly digests: DigestsService) {}

  @Get('digests')
  list(@CurrentUser() user: CurrentUser) {
    return this.digests.list(user.id);
  }

  @Post('digests')
  create(
    @CurrentUser() user: CurrentUser,
    @Body() body: {period: string; categoryNames?: string[]; entityIds?: string[]}
  ) {
    return this.digests.create(user.id, body);
  }

  @Get('digests/:id')
  get(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.digests.get(user.id, id);
  }

  @Get('telemetry/llm')
  telemetry(@CurrentUser() user: CurrentUser) {
    return this.digests.telemetry(user.id);
  }
}
