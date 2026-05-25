export const queueNames = {
  feedPull: 'feed-pull',
  articleProcess: 'article-process',
  regeneration: 'regeneration',
  digest: 'digest'
} as const;

export interface FeedPullJob {
  userId: string;
  feedId: string;
}

export interface ArticleProcessJob {
  userId: string;
  articleId: string;
  regenerationId?: string;
}

export interface RegenerationJob {
  userId: string;
  regenerationId: string;
}

export interface DigestJob {
  userId: string;
  digestId: string;
}
