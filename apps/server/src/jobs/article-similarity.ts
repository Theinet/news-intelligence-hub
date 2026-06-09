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

export interface SimilarityArticle {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  categories: unknown;
  entityIds: string[];
}

export function articleSimilarityScore(left: SimilarityArticle, right: SimilarityArticle): number {
  const textScore = jaccard(articleTokens(left), articleTokens(right));
  const categoryScore = jaccard(categoryTokens(left.categories), categoryTokens(right.categories));
  const entityScore = jaccard(new Set(left.entityIds), new Set(right.entityIds));
  return roundScore(textScore * 0.55 + categoryScore * 0.25 + entityScore * 0.20);
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

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}
