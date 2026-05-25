import {Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../common/prisma.service';
import {QueuesService} from '../jobs/queues.service';

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
    const digest = await this.prisma.digest.create({
      data: {
        userId,
        period: body.period,
        categoryNames: body.categoryNames ?? [],
        entityIds: body.entityIds ?? []
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
