import {BadRequestException, Injectable, UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {PrismaService} from '../common/prisma.service';

const defaultAxes = [
  {name: 'Content type', values: ['news', 'analysis', 'tutorial', 'release', 'opinion']},
  {name: 'Reader level', values: ['junior', 'middle', 'senior']},
  {name: 'Region', values: ['UA', 'EU', 'US', 'global']},
  {name: 'Tone', values: ['neutral', 'promo', 'critical']},
  {name: 'Market impact', values: ['low', 'medium', 'high']}
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async register(email: string, password: string): Promise<{devVerifyUrl: string}> {
    if (!email.includes('@') || password.length < 8) {
      throw new BadRequestException('Email and password are invalid');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = randomBytes(24).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        verificationToken,
        axes: {create: defaultAxes},
        categories: {
          create: [
            {name: 'AI infrastructure'},
            {name: 'Crypto regulation'},
            {name: 'DevTools'}
          ]
        }
      }
    });
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const devVerifyUrl = `${frontend}/verify?token=${verificationToken}`;
    console.log(JSON.stringify({
      level: 'info',
      event: 'auth.dev_verify_link',
      userId: user.id,
      devVerifyUrl
    }));
    return {devVerifyUrl};
  }

  async verify(token: string): Promise<void> {
    const user = await this.prisma.user.findFirst({where: {verificationToken: token}});
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }
    await this.prisma.user.update({
      where: {id: user.id},
      data: {emailVerified: true, verificationToken: null}
    });
  }

  async resend(email: string): Promise<{devVerifyUrl: string}> {
    const user = await this.prisma.user.findUnique({where: {email: email.toLowerCase()}});
    if (!user) {
      throw new BadRequestException('Unknown email');
    }
    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }
    const verificationToken = user.verificationToken ?? randomBytes(24).toString('hex');
    await this.prisma.user.update({where: {id: user.id}, data: {verificationToken}});
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    return {devVerifyUrl: `${frontend}/verify?token=${verificationToken}`};
  }

  async login(email: string, password: string): Promise<{accessToken: string}> {
    const user = await this.prisma.user.findUnique({where: {email: email.toLowerCase()}});
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Bad credentials');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email is not verified');
    }
    const accessToken = await this.jwt.signAsync({sub: user.id, email: user.email});
    return {accessToken};
  }
}
