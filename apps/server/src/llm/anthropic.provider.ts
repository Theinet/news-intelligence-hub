import {envNumber, requiredEnv} from '../common/env';
import {
  ArticleAnalysisInput,
  articleAnalysisResultSchema,
  ArticleAnalysisResult,
  DigestInput,
  digestResultSchema,
  DigestResult,
  LlmProvider,
  LlmProviderResult
} from './contracts';

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest';
  private readonly apiKey = requiredEnv('ANTHROPIC_API_KEY');
  private readonly timeoutMs = envNumber('LLM_TIMEOUT_MS', 30000);

  async analyzeArticle(
    input: ArticleAnalysisInput
  ): Promise<LlmProviderResult<ArticleAnalysisResult>> {
    return this.request<ArticleAnalysisResult>(
      'Analyze this article. Return only valid JSON.',
      JSON.stringify(input),
      articleAnalysisResultSchema
    );
  }

  async buildDigest(input: DigestInput): Promise<LlmProviderResult<DigestResult>> {
    return this.request<DigestResult>(
      'Build a concise news digest. Return only valid JSON with summary.',
      JSON.stringify(input),
      digestResultSchema
    );
  }

  private async request<T>(
    system: string,
    user: string,
    schema: {parse(value: unknown): T}
  ): Promise<LlmProviderResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          system,
          messages: [{role: 'user', content: user}],
          max_tokens: envNumber('LLM_MAX_TOKENS', 1600)
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Anthropic failed with ${response.status}`);
      }
      const payload = await response.json() as {
        content: Array<{type: string; text?: string}>;
        usage?: {input_tokens?: number; output_tokens?: number};
      };
      const text = payload.content.find((item) => item.type === 'text')?.text ?? '{}';
      return {
        data: schema.parse(JSON.parse(text)),
        usage: {
          inputTokens: payload.usage?.input_tokens ?? 0,
          outputTokens: payload.usage?.output_tokens ?? 0
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
