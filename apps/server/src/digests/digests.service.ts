import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../common/prisma.service';
import {QueuesService} from '../jobs/queues.service';
import {DigestPeriod, isDigestPeriod} from './digest-filters';

@Injectable()
export class DigestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService
  ) {}

  list(userId: string) {
    return this.prisma.digest.findMany({where: {userId}, orderBy: {createdAt: 'desc'}});
  }

  async create(userId: string, body: {period: string; categoryNames?: string[]; entityIds?: string[]}) {
    if (!isDigestPeriod(body.period)) {
      throw new BadRequestException('Digest period must be day, week, or month');
    }
    const period: DigestPeriod = body.period;
    const categoryNames = cleanStringArray(body.categoryNames);
    const entityIds = cleanStringArray(body.entityIds);
    const digest = await this.prisma.digest.create({
      data: {
        userId,
        period,
        categoryNames,
        entityIds
      }
    });
    await this.queues.digest.add('digest.build', {userId, digestId: digest.id});
    return digest;
  }

  async get(userId: string, id: string) {
    const digest = await this.prisma.digest.findFirst({where: {id, userId}});
    if (!digest) {
      throw new NotFoundException('Digest not found');
    }
    return digest;
  }

  async telemetry(userId: string) {
    return this.prisma.llmTelemetry.groupBy({
      by: ['operation', 'provider', 'model'],
      where: {userId},
      _sum: {calls: true, inputTokens: true, outputTokens: true, totalTokens: true},
      _count: {_all: true}
    });
  }
}

function cleanStringArray(value?: string[]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => item.trim()).filter(Boolean);
}
