import {PrismaClient} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {createHash} from 'node:crypto';

const prisma = new PrismaClient();

const stopWords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'new',
  'of',
  'on',
  'or',
  'so',
  'that',
  'the',
  'this',
  'to',
  'with'
]);

interface SimilarityArticle {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  categories: unknown;
  entityIds: string[];
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function articleSimilarityScore(left: SimilarityArticle, right: SimilarityArticle): number {
  const textScore = jaccard(articleTokens(left), articleTokens(right));
  const categoryScore = jaccard(categoryTokens(left.categories), categoryTokens(right.categories));
  const entityScore = jaccard(new Set(left.entityIds), new Set(right.entityIds));
  return Math.round((textScore * 0.55 + categoryScore * 0.25 + entityScore * 0.20) * 1000) / 1000;
}

function articleTokens(article: SimilarityArticle): Set<string> {
  return tokenize(`${article.title} ${article.summary ?? ''} ${article.content.slice(0, 2000)}`);
}

function categoryTokens(categories: unknown): Set<string> {
  if (!Array.isArray(categories)) {
    return new Set();
  }
  return tokenize(categories.map(String).join(' '));
}

function tokenize(value: string): Set<string> {
  const words = value.toLowerCase().match(/\p{L}[\p{L}\p{N}]*/gu) ?? [];
  return new Set(words.filter((word) => word.length > 1 && !stopWords.has(word)));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) {
      intersection++;
    }
  }
  return intersection / (left.size + right.size - intersection);
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.searchParams.sort();
  if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString().toLowerCase();
}

function demoCategories(title: string): string[] {
  if (title.includes('crypto')) {
    return ['Crypto regulation'];
  }
  if (title.includes('DevTools')) {
    return ['DevTools'];
  }
  return ['AI infrastructure'];
}

async function refreshSimilarityCounts(userId: string, articleIds: string[]): Promise<void> {
  for (const articleId of articleIds) {
    const article = await prisma.article.findFirst({
      where: {userId, id: articleId},
      select: {contentHash: true, normalizedUrl: true}
    });
    if (!article) {
      continue;
    }
    const [duplicates, similarEdges] = await Promise.all([
      prisma.article.findMany({
        where: {
          userId,
          id: {not: articleId},
          OR: [{contentHash: article.contentHash}, {normalizedUrl: article.normalizedUrl}]
        },
        select: {id: true}
      }),
      prisma.graphEdge.findMany({
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
    await prisma.article.update({
      where: {id: articleId},
      data: {similarCount: similarArticleIds.size}
    });
  }
}

async function main(): Promise<void> {
  const email = process.env.SEED_DEMO_EMAIL ?? 'demo@example.com';
  const password = process.env.SEED_DEMO_PASSWORD ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: {email},
    update: {},
    create: {
      email,
      passwordHash,
      emailVerified: true,
      categories: {
        create: [
          {name: 'AI infrastructure'},
          {name: 'Crypto regulation'},
          {name: 'DevTools'}
        ]
      },
      axes: {
        create: [
          {name: 'Content type', values: ['news', 'analysis', 'tutorial', 'release', 'opinion']},
          {name: 'Reader level', values: ['junior', 'middle', 'senior']},
          {name: 'Region', values: ['UA', 'EU', 'US', 'global']},
          {name: 'Tone', values: ['neutral', 'promo', 'critical']}
        ]
      }
    }
  });
  const feed = await prisma.feed.upsert({
    where: {userId_url: {userId: user.id, url: 'https://www.theverge.com/rss/index.xml'}},
    update: {},
    create: {userId: user.id, url: 'https://www.theverge.com/rss/index.xml', title: 'Demo Tech Feed'}
  });
  const demoArticles = [
    {
      title: 'Microsoft ships new AI runtime for developers',
      url: 'https://blogs.microsoft.com/ai/',
      content: 'Microsoft and OpenAI announced a new AI infrastructure runtime for developers. The release focuses on inference efficiency, React tooling, and PostgreSQL-backed observability for enterprise teams building production systems.',
      publishedAt: new Date()
    },
    {
      title: 'EU crypto regulation update mentions Bitcoin and Ethereum',
      url: 'https://finance.ec.europa.eu/digital-finance/crypto-assets_en',
      content: 'The European Union published a crypto regulation update that affects Bitcoin and Ethereum projects. Analysts expect compliance teams to watch market impact and reporting obligations through the next quarter.',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    {
      title: 'Anthropic expands DevTools guidance for AI teams',
      url: 'https://www.anthropic.com/news',
      content: 'Anthropic released guidance for DevTools teams integrating AI assistants into software workflows. The document discusses secure prompt design, evaluation, and production telemetry for senior engineering teams.',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
    }
  ];
  const demoUrls = demoArticles.map((item) => normalizeUrl(item.url));
  const demoTitles = demoArticles.map((item) => item.title);
  const staleDemoArticles = await prisma.article.findMany({
    where: {
      userId: user.id,
      title: {in: demoTitles},
      normalizedUrl: {notIn: demoUrls}
    },
    select: {id: true}
  });
  await prisma.articleEntity.deleteMany({
    where: {articleId: {in: staleDemoArticles.map((article) => article.id)}}
  });
  await prisma.article.deleteMany({
    where: {id: {in: staleDemoArticles.map((article) => article.id)}}
  });
  await prisma.feed.deleteMany({
    where: {userId: user.id, url: 'https://demo.local/rss.xml'}
  });
  const existingDemoArticles = await prisma.article.findMany({
    where: {userId: user.id, normalizedUrl: {in: demoUrls}},
    select: {id: true}
  });
  await prisma.graphEdge.deleteMany({where: {userId: user.id}});
  await prisma.articleEntity.deleteMany({
    where: {articleId: {in: existingDemoArticles.map((article) => article.id)}}
  });
  for (const item of demoArticles) {
    const normalizedUrl = normalizeUrl(item.url);
    const content = Array.from({length: 5}, () => item.content).join(' ');
    const article = await prisma.article.upsert({
      where: {userId_normalizedUrl: {userId: user.id, normalizedUrl}},
      update: {
        feedId: feed.id,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        content,
        contentHash: sha256(content),
        status: 'processed',
        summary: item.content,
        fullSummary: item.content,
        importance: 'high',
        categories: demoCategories(item.title),
        axes: {Region: item.title.includes('EU') ? 'EU' : 'global', Tone: 'neutral'}
      },
      create: {
        userId: user.id,
        feedId: feed.id,
        title: item.title,
        url: item.url,
        normalizedUrl,
        publishedAt: item.publishedAt,
        content,
        contentHash: sha256(content),
        status: 'processed',
        summary: item.content,
        fullSummary: item.content,
        importance: 'high',
        categories: demoCategories(item.title),
        axes: {Region: item.title.includes('EU') ? 'EU' : 'global', Tone: 'neutral'}
      }
    });
    const names = ['Microsoft', 'OpenAI', 'Anthropic', 'Bitcoin', 'Ethereum', 'European Union']
      .filter((name) => item.content.includes(name));
    const entityIds: string[] = [];
    for (const name of names) {
      const entity = await prisma.entity.upsert({
        where: {
          userId_normalizedKey_type: {
            userId: user.id,
            normalizedKey: name.toLowerCase(),
            type: name === 'European Union' ? 'location' : name.includes('coin') || name === 'Ethereum' ? 'project' : 'company'
          }
        },
        update: {},
        create: {
          userId: user.id,
          canonicalName: name,
          normalizedKey: name.toLowerCase(),
          type: name === 'European Union' ? 'location' : name.includes('coin') || name === 'Ethereum' ? 'project' : 'company',
          aliases: name === 'Microsoft' ? ['MSFT', 'Microsoft Corp.', 'MS'] : [],
          description: `${name} demo entity.`,
          firstSeen: item.publishedAt,
          lastSeen: item.publishedAt
        }
      });
      entityIds.push(entity.id);
      await prisma.articleEntity.upsert({
        where: {articleId_entityId: {articleId: article.id, entityId: entity.id}},
        update: {},
        create: {articleId: article.id, entityId: entity.id}
      });
      await prisma.graphEdge.upsert({
        where: {
          userId_fromId_toId_kind: {
            userId: user.id,
            fromId: article.id,
            toId: entity.id,
            kind: 'mentions'
          }
        },
        update: {},
        create: {userId: user.id, fromId: article.id, toId: entity.id, kind: 'mentions'}
      });
    }
    for (let left = 0; left < entityIds.length; left++) {
      for (let right = left + 1; right < entityIds.length; right++) {
        const pair = [entityIds[left], entityIds[right]].sort();
        await prisma.graphEdge.upsert({
          where: {
            userId_fromId_toId_kind: {
              userId: user.id,
              fromId: pair[0],
              toId: pair[1],
              kind: 'co_mention'
            }
          },
          update: {},
          create: {userId: user.id, fromId: pair[0], toId: pair[1], kind: 'co_mention', weight: 1}
        });
      }
    }
  }
  const seededArticles = await prisma.article.findMany({
    where: {userId: user.id, status: 'processed'},
    include: {mentions: {select: {entityId: true}}},
    orderBy: {publishedAt: 'desc'},
    take: Number(process.env.SIMILARITY_MAX_CANDIDATES ?? 80)
  });
  const minSimilarityScore = Number(process.env.SIMILARITY_MIN_SCORE ?? 0.22);
  for (let left = 0; left < seededArticles.length; left++) {
    for (let right = left + 1; right < seededArticles.length; right++) {
      const leftArticle: SimilarityArticle = {
        id: seededArticles[left].id,
        title: seededArticles[left].title,
        content: seededArticles[left].content,
        summary: seededArticles[left].summary,
        categories: seededArticles[left].categories,
        entityIds: seededArticles[left].mentions.map((mention) => mention.entityId)
      };
      const rightArticle: SimilarityArticle = {
        id: seededArticles[right].id,
        title: seededArticles[right].title,
        content: seededArticles[right].content,
        summary: seededArticles[right].summary,
        categories: seededArticles[right].categories,
        entityIds: seededArticles[right].mentions.map((mention) => mention.entityId)
      };
      const score = articleSimilarityScore(leftArticle, rightArticle);
      const [fromId, toId] = [seededArticles[left].id, seededArticles[right].id].sort();
      if (score >= minSimilarityScore) {
        await prisma.graphEdge.upsert({
          where: {
            userId_fromId_toId_kind: {
              userId: user.id,
              fromId,
              toId,
              kind: 'similar'
            }
          },
          update: {score},
          create: {userId: user.id, fromId, toId, kind: 'similar', score}
        });
      }
    }
  }
  await refreshSimilarityCounts(user.id, seededArticles.map((article) => article.id));
  console.log(`Seeded demo user ${email} / ${password}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
