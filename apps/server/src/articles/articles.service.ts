import {Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../common/prisma.service';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: {
      category?: string;
      feedId?: string;
      importance?: string;
      status?: string;
      from?: string;
      to?: string;
    }
  ) {
    const articles = await this.prisma.article.findMany({
      where: {
        userId,
        feedId: query.feedId,
        importance: query.importance === undefined ? undefined : query.importance as never,
        status: query.status === undefined ? undefined : query.status as never,
        publishedAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined
        }
      },
      include: {feed: true, mentions: {include: {entity: true}}},
      orderBy: {publishedAt: 'desc'},
      take: 100
    });
    return articles.filter((article) => {
      if (!query.category) {
        return true;
      }
      const categories = article.categories as string[];
      return categories.includes(query.category);
    });
  }

  async get(userId: string, id: string) {
    const article = await this.prisma.article.findFirst({
      where: {id, userId},
      include: {feed: true, mentions: {include: {entity: true}}}
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    const similar = await this.prisma.article.findMany({
      where: {
        userId,
        id: {not: id},
        OR: [
          {contentHash: article.contentHash},
          {normalizedUrl: article.normalizedUrl}
        ]
      },
      select: {id: true, title: true, url: true, publishedAt: true, feed: true},
      take: 20
    });
    return {...article, similar};
  }

  async entity(userId: string, id: string) {
    const entity = await this.prisma.entity.findFirst({
      where: {id, userId},
      include: {
        mentions: {
          include: {
            article: {select: {id: true, title: true, publishedAt: true, summary: true}}
          },
          orderBy: {article: {publishedAt: 'desc'}}
        }
      }
    });
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }
    const related = await this.prisma.graphEdge.findMany({
      where: {userId, kind: 'co_mention', OR: [{fromId: id}, {toId: id}]},
      orderBy: {weight: 'desc'},
      take: 20
    });
    const relatedIds = related.map((edge) => edge.fromId === id ? edge.toId : edge.fromId);
    const relatedEntities = await this.prisma.entity.findMany({where: {id: {in: relatedIds}, userId}});
    const activity = await this.prisma.article.groupBy({
      by: ['publishedAt'],
      where: {userId, mentions: {some: {entityId: id}}},
      _count: {_all: true}
    });
    return {
      ...entity,
      related: related.map((edge) => ({
        entity: relatedEntities.find((item) => item.id === (edge.fromId === id ? edge.toId : edge.fromId)),
        weight: edge.weight ?? 0
      })),
      activity
    };
  }
}
