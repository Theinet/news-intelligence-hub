import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {PrismaService} from '../common/prisma.service';
import {CurrentUser} from './current-user';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: CurrentUser;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length);
    let payload: {sub: string; email: string};
    try {
      payload = await this.jwt.verifyAsync<{sub: string; email: string}>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await this.prisma.user.findUnique({where: {id: payload.sub}});
    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Email is not verified');
    }
    request.user = {id: user.id, email: user.email};
    return true;
  }
}
