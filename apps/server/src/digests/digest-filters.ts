export const digestPeriods = ['day', 'week', 'month'] as const;

export type DigestPeriod = typeof digestPeriods[number];

interface DigestFilterArticle {
  categories: unknown;
  mentions?: Array<{entityId: string}>;
}

export function isDigestPeriod(value: string): value is DigestPeriod {
  return digestPeriods.includes(value as DigestPeriod);
}

export function digestPeriodStart(period: DigestPeriod, now = new Date()): Date {
  const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function digestArticleMatchesFilters(
  article: DigestFilterArticle,
  categoryNames: string[],
  entityIds: string[]
): boolean {
  if (categoryNames.length > 0 && !articleHasSelectedCategory(article.categories, categoryNames)) {
    return false;
  }
  if (entityIds.length > 0 && !articleHasSelectedEntity(article.mentions ?? [], entityIds)) {
    return false;
  }
  return true;
}

function articleHasSelectedCategory(rawCategories: unknown, selected: string[]): boolean {
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const selectedSet = new Set(selected.map((category) => category.trim().toLowerCase()));
  return categories.some((category) => (
    typeof category === 'string' && selectedSet.has(category.trim().toLowerCase())
  ));
}

function articleHasSelectedEntity(mentions: Array<{entityId: string}>, entityIds: string[]): boolean {
  const selectedSet = new Set(entityIds);
  return mentions.some((mention) => selectedSet.has(mention.entityId));
}
