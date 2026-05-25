import {Body, Controller, Get, Post, Query} from '@nestjs/common';
import {AuthService} from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: {email: string; password: string}) {
    return this.auth.register(body.email, body.password);
  }

  @Get('verify')
  async verify(@Query('token') token: string): Promise<{ok: true}> {
    await this.auth.verify(token);
    return {ok: true};
  }

  @Post('resend')
  resend(@Body() body: {email: string}) {
    return this.auth.resend(body.email);
  }

  @Post('login')
  login(@Body() body: {email: string; password: string}) {
    return this.auth.login(body.email, body.password);
  }
}
