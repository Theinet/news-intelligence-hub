import {Injectable} from '@nestjs/common';
import {envBool} from '../common/env';
import {PrismaService} from '../common/prisma.service';
import {AnthropicProvider} from './anthropic.provider';
import {
  ArticleAnalysisInput,
  ArticleAnalysisResult,
  DigestInput,
  DigestResult,
  LlmProvider
} from './contracts';
import {MockProvider} from './mock.provider';
import {OpenAiProvider} from './openai.provider';

@Injectable()
export class LlmService {
  private readonly primary: LlmProvider;
  private readonly fallback?: LlmProvider;

  constructor(private readonly prisma: PrismaService) {
    if (envBool('LLM_MOCK', true)) {
      this.primary = new MockProvider();
      return;
    }
    const provider = process.env.LLM_PROVIDER ?? 'openai';
    this.primary = provider === 'anthropic' ? new AnthropicProvider() : new OpenAiProvider();
    this.fallback = provider === 'anthropic' ? new OpenAiProvider() : new AnthropicProvider();
  }

  async analyzeArticle(
    userId: string,
    input: ArticleAnalysisInput,
    operation = 'article_processing'
  ): Promise<ArticleAnalysisResult> {
    const result = await this.withFailover((provider) => provider.analyzeArticle(input));
    await this.recordUsage(userId, operation, result.provider, result.model, result.usage);
    return result.data;
  }

  async buildDigest(userId: string, input: DigestInput): Promise<DigestResult> {
    const result = await this.withFailover((provider) => provider.buildDigest(input));
    await this.recordUsage(userId, 'digest', result.provider, result.model, result.usage);
    return result.data;
  }

  private async withFailover<T>(
    call: (provider: LlmProvider) => Promise<{data: T; usage: {inputTokens: number; outputTokens: number}}>
  ): Promise<{data: T; usage: {inputTokens: number; outputTokens: number}; provider: string; model: string}> {
    try {
      const result = await call(this.primary);
      return {...result, provider: this.primary.name, model: this.primary.model};
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'llm.primary_failed',
        provider: this.primary.name,
        message: error instanceof Error ? error.message : String(error)
      }));
      if (!this.fallback) {
        throw error;
      }
      const result = await call(this.fallback);
      return {...result, provider: this.fallback.name, model: this.fallback.model};
    }
  }

  private async recordUsage(
    userId: string,
    operation: string,
    provider: string,
    model: string,
    usage: {inputTokens: number; outputTokens: number}
  ): Promise<void> {
    await this.prisma.llmTelemetry.create({
      data: {
        userId,
        operation,
        provider,
        model,
        calls: 1,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.inputTokens + usage.outputTokens
      }
    });
  }
}
