import {z} from 'zod';

export const entitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['person', 'company', 'product', 'technology', 'location', 'project', 'other']),
  aliases: z.array(z.string()).default([]),
  description: z.string().optional()
});

export const articleAnalysisResultSchema = z.object({
  entities: z.array(entitySchema).max(30),
  summary: z.string().min(20),
  fullSummary: z.string().min(20),
  importance: z.enum(['high', 'normal', 'junk']),
  categories: z.array(z.string()),
  axes: z.record(z.string(), z.string())
});

export const digestResultSchema = z.object({
  summary: z.string().min(20)
});

export type ArticleAnalysisResult = z.infer<typeof articleAnalysisResultSchema>;
export type DigestResult = z.infer<typeof digestResultSchema>;

export interface ArticleAnalysisInput {
  title: string;
  content: string;
  categories: string[];
  axes: Array<{name: string; values: string[]}>;
}

export interface DigestInput {
  period: string;
  topEntities: Array<{name: string; count: number}>;
  topCategories: Array<{name: string; count: number}>;
  keyArticles: Array<{title: string; summary: string | null}>;
}

export interface EntityMatchInput {
  candidate: string;
  existing: Array<{id: string; canonicalName: string; aliases: string[]}>;
}

export interface EntityMatchResult {
  matchedId?: string;
  canonicalName: string;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmProviderResult<T> {
  data: T;
  usage: LlmUsage;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  analyzeArticle(input: ArticleAnalysisInput): Promise<LlmProviderResult<ArticleAnalysisResult>>;
  buildDigest(input: DigestInput): Promise<LlmProviderResult<DigestResult>>;
}
