import {Injectable} from '@nestjs/common';
import {PrismaService} from '../common/prisma.service';
import {
  digestArticleMatchesFilters,
  digestPeriodStart,
  isDigestPeriod
} from '../digests/digest-filters';
import {LlmService} from '../llm/llm.service';

@Injectable()
export class DigestBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService
  ) {}

  async build(userId: string, digestId: string): Promise<void> {
    const digest = await this.prisma.digest.findFirst({where: {id: digestId, userId}});
    if (!digest) {
      return;
    }
    try {
      const period = isDigestPeriod(digest.period) ? digest.period : 'day';
      const since = digestPeriodStart(period);
      const categoryNames = normalizeStringArray(digest.categoryNames);
      const entityIds = normalizeStringArray(digest.entityIds);
      const candidates = await this.prisma.article.findMany({
        where: {
          userId,
          status: 'processed',
          publishedAt: {gte: since},
          mentions: entityIds.length > 0 ? {some: {entityId: {in: entityIds}}} : undefined
        },
        include: {mentions: {include: {entity: true}}},
        orderBy: [{importance: 'asc'}, {publishedAt: 'desc'}],
        take: 30
      });
      const articles = candidates.filter((article) => (
        digestArticleMatchesFilters(article, categoryNames, entityIds)
      ));
      const entityCounts = new Map<string, number>();
      const categoryCounts = new Map<string, number>();
      for (const article of articles) {
        for (const mention of article.mentions) {
          entityCounts.set(mention.entity.canonicalName, (entityCounts.get(mention.entity.canonicalName) ?? 0) + 1);
        }
        for (const category of article.categories as string[]) {
          categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
        }
      }
      const topEntities = [...entityCounts.entries()]
        .map(([name, count]) => ({name, count}))
        .sort((left, right) => right.count - left.count)
        .slice(0, 10);
      const topCategories = [...categoryCounts.entries()]
        .map(([name, count]) => ({name, count}))
        .sort((left, right) => right.count - left.count)
        .slice(0, 10);
      const keyArticles = articles.slice(0, 8).map((article) => ({
        id: article.id,
        title: article.title,
        summary: article.summary
      }));
      const result = await this.llm.buildDigest(userId, {
        period,
        topEntities,
        topCategories,
        keyArticles
      });
      await this.prisma.digest.update({
        where: {id: digest.id},
        data: {status: 'ready', topEntities, topCategories, keyArticles, summary: result.summary}
      });
    } catch (error) {
      await this.prisma.digest.update({
        where: {id: digest.id},
        data: {status: 'error', error: error instanceof Error ? error.message : String(error)}
      });
    }
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}
