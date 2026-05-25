import {Controller, Get, Query, UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CurrentUser} from '../auth/current-user';
import {GraphService} from './graph.service';

@UseGuards(AuthGuard)
@Controller('graph')
export class GraphController {
  constructor(private readonly graph: GraphService) {}

  @Get()
  get(@CurrentUser() user: CurrentUser, @Query() query: {nodeKind?: string; category?: string; q?: string}) {
    return this.graph.get(user.id, query);
  }
}
