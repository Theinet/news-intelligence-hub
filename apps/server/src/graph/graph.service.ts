import {Injectable} from '@nestjs/common';
import {categoryMatchesQuery} from '../common/category-filter';
import {PrismaService} from '../common/prisma.service';

@Injectable()
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, query: {nodeKind?: string; category?: string; q?: string}) {
    const articles = await this.prisma.article.findMany({
      where: {userId, status: {in: ['processed', 'filtered']}},
      include: {mentions: {include: {entity: true}}},
      orderBy: {publishedAt: 'desc'},
      take: 150
    });
    const categoryQuery = query.category?.trim().toLowerCase();
    const searchQuery = query.q?.trim().toLowerCase();
    const filteredArticles = articles.filter((article) => {
      const categoryOk = categoryMatchesQuery(article.categories as string[], categoryQuery);
      const searchOk = !searchQuery || article.title.toLowerCase().includes(searchQuery);
      return categoryOk && searchOk;
    });
    const entityMap = new Map<string, {id: string; label: string; entityType: string}>();
    const nodes = [];
    if (query.nodeKind !== 'entity') {
      for (const article of filteredArticles) {
        nodes.push({
          id: article.id,
          kind: 'article',
          label: article.title,
          ts: Math.floor(article.publishedAt.getTime() / 1000),
          importance: article.importance
        });
      }
    }
    for (const article of filteredArticles) {
      for (const mention of article.mentions) {
        entityMap.set(mention.entity.id, {
          id: mention.entity.id,
          label: mention.entity.canonicalName,
          entityType: mention.entity.type
        });
      }
    }
    if (query.nodeKind !== 'article') {
      nodes.push(...Array.from(entityMap.values()).map((entity) => ({
        id: entity.id,
        kind: 'entity',
        label: entity.label,
        entityType: entity.entityType
      })));
    }
    const articleIds = filteredArticles.map((article) => article.id);
    const entityIds = Array.from(entityMap.keys());
    const edges = await this.prisma.graphEdge.findMany({
      where: {
        userId,
        OR: [
          {fromId: {in: articleIds}, toId: {in: entityIds}},
          {fromId: {in: entityIds}, toId: {in: entityIds}},
          {fromId: {in: articleIds}, toId: {in: articleIds}}
        ]
      },
      take: 600
    });
    return {
      nodes,
      edges: edges.map((edge) => ({
        from: edge.fromId,
        to: edge.toId,
        kind: edge.kind,
        weight: edge.weight,
        score: edge.score
      }))
    };
  }
}
