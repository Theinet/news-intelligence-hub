import {PrismaClient} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {createHash} from 'node:crypto';

const prisma = new PrismaClient();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
    where: {userId_url: {userId: user.id, url: 'https://demo.local/rss.xml'}},
    update: {},
    create: {userId: user.id, url: 'https://demo.local/rss.xml', title: 'Demo Tech Feed'}
  });
  const demoArticles = [
    {
      title: 'Microsoft ships new AI runtime for developers',
      url: 'https://demo.local/articles/microsoft-ai-runtime',
      content: 'Microsoft and OpenAI announced a new AI infrastructure runtime for developers. The release focuses on inference efficiency, React tooling, and PostgreSQL-backed observability for enterprise teams building production systems.',
      publishedAt: new Date()
    },
    {
      title: 'EU crypto regulation update mentions Bitcoin and Ethereum',
      url: 'https://demo.local/articles/eu-crypto-regulation',
      content: 'The European Union published a crypto regulation update that affects Bitcoin and Ethereum projects. Analysts expect compliance teams to watch market impact and reporting obligations through the next quarter.',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    {
      title: 'Anthropic expands DevTools guidance for AI teams',
      url: 'https://demo.local/articles/anthropic-devtools',
      content: 'Anthropic released guidance for DevTools teams integrating AI assistants into software workflows. The document discusses secure prompt design, evaluation, and production telemetry for senior engineering teams.',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
    }
  ];
  const demoUrls = demoArticles.map((item) => normalizeUrl(item.url));
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
        categories: item.title.includes('crypto') ? ['Crypto regulation'] : ['AI infrastructure'],
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
        categories: item.title.includes('crypto') ? ['Crypto regulation'] : ['AI infrastructure'],
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
  console.log(`Seeded demo user ${email} / ${password}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
