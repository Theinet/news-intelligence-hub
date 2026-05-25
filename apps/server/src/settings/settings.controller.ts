import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CurrentUser} from '../auth/current-user';
import {SettingsService} from './settings.service';

@UseGuards(AuthGuard)
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('categories')
  categories(@CurrentUser() user: CurrentUser) {
    return this.settings.categories(user.id);
  }

  @Post('categories')
  createCategory(@CurrentUser() user: CurrentUser, @Body() body: {name: string; description?: string}) {
    return this.settings.createCategory(user.id, body);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: {name?: string; description?: string}
  ) {
    return this.settings.updateCategory(user.id, id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.settings.deleteCategory(user.id, id);
  }

  @Get('axes')
  axes(@CurrentUser() user: CurrentUser) {
    return this.settings.axes(user.id);
  }

  @Post('axes')
  createAxis(@CurrentUser() user: CurrentUser, @Body() body: {name: string; values: string[]}) {
    return this.settings.createAxis(user.id, body);
  }

  @Patch('axes/:id')
  updateAxis(
    @CurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() body: {name?: string; values?: string[]}
  ) {
    return this.settings.updateAxis(user.id, id, body);
  }

  @Delete('axes/:id')
  deleteAxis(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.settings.deleteAxis(user.id, id);
  }

  @Post('regenerations')
  startRegeneration(@CurrentUser() user: CurrentUser) {
    return this.settings.startRegeneration(user.id);
  }

  @Get('regenerations/:id')
  regeneration(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.settings.regeneration(user.id, id);
  }
}
