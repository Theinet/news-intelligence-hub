import {Injectable} from '@nestjs/common';
import {EntityType, Prisma} from '@prisma/client';
import {stableJsonHash} from '../common/hash';
import {PrismaService} from '../common/prisma.service';
import {normalizeEntityName} from '../common/text';
import {ArticleAnalysisResult, articleAnalysisResultSchema} from '../llm/contracts';
import {LlmService} from '../llm/llm.service';
import {articleSimilarityScore, SimilarityArticle} from './article-similarity';
import {prefilterArticle} from './prefilter';

@Injectable()
export class ArticleProcessorService {
  private readonly similarityLookbackDays =
    Number(process.env.SIMILARITY_LOOKBACK_DAYS ?? 45) || 45;
  private readonly similarityMaxCandidates =
    Number(process.env.SIMILARITY_MAX_CANDIDATES ?? 80) || 80;
  private readonly similarityMinScore =
    Number(process.env.SIMILARITY_MIN_SCORE ?? 0.22) || 0.22;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService
  ) {}

  async process(userId: string, articleId: string, regenerationId?: string): Promise<void> {
    const article = await this.prisma.article.findFirst({where: {id: articleId, userId}});
    if (!article) {
      return;
    }
    const prefilter = prefilterArticle(article.content);
    if (!prefilter.accepted) {
      await this.prisma.article.update({
        where: {id: article.id},
        data: {status: 'filtered', importance: 'junk', filterReason: prefilter.reason}
      });
      await this.incrementRegeneration(regenerationId);
      return;
    }
    const [categories, axes] = await Promise.all([
      this.prisma.category.findMany({where: {userId}, orderBy: {name: 'asc'}}),
      this.prisma.categoryAxis.findMany({where: {userId}, orderBy: {createdAt: 'asc'}})
    ]);
    const axisInput = axes.map((axis) => ({
      name: axis.name,
      values: Array.isArray(axis.values) ? axis.values.map(String) : []
    }));
    const axesHash = stableJsonHash({categories: categories.map((item) => item.name), axes: axisInput});
    const cached = await this.prisma.llmCache.findUnique({
      where: {contentHash_axesHash: {contentHash: article.contentHash, axesHash}}
    });
    const analysis: ArticleAnalysisResult = cached ?
      articleAnalysisResultSchema.parse(cached.result) :
      await this.llm.analyzeArticle(userId, {
        title: article.title,
        content: article.content.slice(0, Number(process.env.LLM_MAX_INPUT_CHARS ?? 12000)),
        categories: categories.map((item) => item.name),
        axes: axisInput
      }, regenerationId ? 'regeneration' : 'article_processing');
    if (!cached) {
      await this.prisma.llmCache.create({
        data: {contentHash: article.contentHash, axesHash, result: analysis}
      });
    }
    await this.prisma.articleEntity.deleteMany({where: {articleId: article.id}});
    const entityIds = [];
    for (const entity of analysis.entities) {
      const normalizedKey = normalizeEntityName(entity.name);
      const saved = await this.prisma.entity.upsert({
        where: {
          userId_normalizedKey_type: {
            userId,
            normalizedKey,
            type: entity.type as EntityType
          }
        },
        create: {
          userId,
          canonicalName: entity.name,
          normalizedKey,
          type: entity.type as EntityType,
          aliases: Array.from(new Set(entity.aliases ?? [])) as Prisma.InputJsonValue,
          description: entity.description,
          firstSeen: article.publishedAt,
          lastSeen: article.publishedAt
        },
        update: {
          aliases: Array.from(new Set([...(entity.aliases ?? []), entity.name])) as Prisma.InputJsonValue,
          description: entity.description,
          firstSeen: article.publishedAt < article.publishedAt ? article.publishedAt : undefined,
          lastSeen: article.publishedAt
        }
      });
      entityIds.push(saved.id);
      await this.prisma.articleEntity.upsert({
        where: {articleId_entityId: {articleId: article.id, entityId: saved.id}},
        create: {articleId: article.id, entityId: saved.id},
        update: {}
      });
      await this.prisma.graphEdge.upsert({
        where: {
          userId_fromId_toId_kind: {
            userId,
            fromId: article.id,
            toId: saved.id,
            kind: 'mentions'
          }
        },
        create: {userId, fromId: article.id, toId: saved.id, kind: 'mentions'},
        update: {}
      });
    }
    for (let left = 0; left < entityIds.length; left++) {
      for (let right = left + 1; right < entityIds.length; right++) {
        const pair = [entityIds[left], entityIds[right]].sort();
        await this.prisma.graphEdge.upsert({
          where: {
            userId_fromId_toId_kind: {
              userId,
              fromId: pair[0],
              toId: pair[1],
              kind: 'co_mention'
            }
          },
          create: {userId, fromId: pair[0], toId: pair[1], kind: 'co_mention', weight: 1},
          update: {weight: {increment: 1}}
        });
      }
    }
    await this.prisma.article.update({
      where: {id: article.id},
      data: {
        summary: analysis.summary,
        fullSummary: analysis.fullSummary,
        importance: analysis.importance,
        categories: analysis.categories,
        axes: analysis.axes,
        status: 'processed',
        llmCacheHit: Boolean(cached)
      }
    });
    await this.updateSemanticSimilarity(userId, {
      id: article.id,
      title: article.title,
      content: article.content,
      summary: analysis.summary,
      categories: analysis.categories,
      entityIds
    }, article.publishedAt);
    await this.updateRelatedSimilarityCounts(userId, article.id);
    await this.incrementRegeneration(regenerationId);
    console.log(JSON.stringify({
      level: 'info',
      event: 'article.processed',
      userId,
      articleId: article.id,
      entityCount: entityIds.length,
      cacheHit: Boolean(cached)
    }));
  }

  private async updateSemanticSimilarity(
    userId: string,
    current: SimilarityArticle,
    publishedAt: Date
  ): Promise<void> {
    if (this.similarityMaxCandidates <= 0 || this.similarityMinScore > 1) {
      return;
    }
    const windowMs = Math.max(this.similarityLookbackDays, 1) * 24 * 60 * 60 * 1000;
    const candidates = await this.prisma.article.findMany({
      where: {
        userId,
        id: {not: current.id},
        status: 'processed',
        publishedAt: {
          gte: new Date(publishedAt.getTime() - windowMs),
          lte: new Date(publishedAt.getTime() + windowMs)
        }
      },
      include: {mentions: {select: {entityId: true}}},
      orderBy: {publishedAt: 'desc'},
      take: Math.max(this.similarityMaxCandidates, 1)
    });
    const affectedArticleIds = new Set<string>();
    for (const candidate of candidates) {
      const score = articleSimilarityScore(current, {
        id: candidate.id,
        title: candidate.title,
        content: candidate.content,
        summary: candidate.summary,
        categories: candidate.categories,
        entityIds: candidate.mentions.map((mention) => mention.entityId)
      });
      const [fromId, toId] = [current.id, candidate.id].sort();
      if (score >= this.similarityMinScore) {
        affectedArticleIds.add(candidate.id);
        await this.prisma.graphEdge.upsert({
          where: {
            userId_fromId_toId_kind: {
              userId,
              fromId,
              toId,
              kind: 'similar'
            }
          },
          create: {userId, fromId, toId, kind: 'similar', score},
          update: {score}
        });
      } else {
        const deleted = await this.prisma.graphEdge.deleteMany({
          where: {userId, fromId, toId, kind: 'similar'}
        });
        if (deleted.count > 0) {
          affectedArticleIds.add(candidate.id);
        }
      }
    }
    for (const articleId of affectedArticleIds) {
      await this.updateArticleSimilarityCount(userId, articleId);
    }
  }

  private async updateArticleSimilarityCount(userId: string, articleId: string): Promise<number> {
    const article = await this.prisma.article.findFirst({
      where: {userId, id: articleId},
      select: {contentHash: true, normalizedUrl: true}
    });
    if (!article) {
      return 0;
    }
    const [duplicates, similarEdges] = await Promise.all([
      this.prisma.article.findMany({
        where: {
          userId,
          id: {not: articleId},
          OR: [{contentHash: article.contentHash}, {normalizedUrl: article.normalizedUrl}]
        },
        select: {id: true}
      }),
      this.prisma.graphEdge.findMany({
        where: {
          userId,
          kind: 'similar',
          OR: [{fromId: articleId}, {toId: articleId}]
        },
        select: {fromId: true, toId: true}
      })
    ]);
    const similarArticleIds = new Set(duplicates.map((duplicate) => duplicate.id));
    for (const edge of similarEdges) {
      similarArticleIds.add(edge.fromId === articleId ? edge.toId : edge.fromId);
    }
    const similarCount = similarArticleIds.size;
    await this.prisma.article.update({
      where: {id: articleId},
      data: {similarCount}
    });
    return similarCount;
  }

  private async updateRelatedSimilarityCounts(userId: string, articleId: string): Promise<void> {
    const article = await this.prisma.article.findFirst({
      where: {userId, id: articleId},
      select: {contentHash: true, normalizedUrl: true}
    });
    if (!article) {
      return;
    }
    const [duplicates, similarEdges] = await Promise.all([
      this.prisma.article.findMany({
        where: {
          userId,
          id: {not: articleId},
          OR: [{contentHash: article.contentHash}, {normalizedUrl: article.normalizedUrl}]
        },
        select: {id: true}
      }),
      this.prisma.graphEdge.findMany({
        where: {userId, kind: 'similar', OR: [{fromId: articleId}, {toId: articleId}]},
        select: {fromId: true, toId: true}
      })
    ]);
    const articleIds = new Set<string>([articleId]);
    for (const duplicate of duplicates) {
      articleIds.add(duplicate.id);
    }
    for (const edge of similarEdges) {
      articleIds.add(edge.fromId === articleId ? edge.toId : edge.fromId);
    }
    for (const id of articleIds) {
      await this.updateArticleSimilarityCount(userId, id);
    }
  }

  private async incrementRegeneration(regenerationId?: string): Promise<void> {
    if (!regenerationId) {
      return;
    }
    const run = await this.prisma.regenerationRun.update({
      where: {id: regenerationId},
      data: {processed: {increment: 1}}
    });
    if (run.processed >= run.total) {
      await this.prisma.regenerationRun.update({
        where: {id: regenerationId},
        data: {status: 'done'}
      });
    }
  }
}
