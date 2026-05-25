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

export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  readonly model = process.env.LLM_MODEL ?? 'gpt-4.1-mini';
  private readonly apiKey = requiredEnv('OPENAI_API_KEY');
  private readonly timeoutMs = envNumber('LLM_TIMEOUT_MS', 30000);

  async analyzeArticle(
    input: ArticleAnalysisInput
  ): Promise<LlmProviderResult<ArticleAnalysisResult>> {
    const data = await this.request<ArticleAnalysisResult>(
      'Analyze this article as strict JSON.',
      JSON.stringify(input),
      articleAnalysisResultSchema
    );
    return data;
  }

  async buildDigest(input: DigestInput): Promise<LlmProviderResult<DigestResult>> {
    return this.request<DigestResult>(
      'Build a concise news digest as strict JSON with a summary field.',
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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          response_format: {type: 'json_object'},
          messages: [
            {role: 'system', content: system},
            {role: 'user', content: user}
          ],
          max_tokens: envNumber('LLM_MAX_TOKENS', 1600)
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`OpenAI failed with ${response.status}`);
      }
      const payload = await response.json() as {
        choices: Array<{message: {content: string}}>;
        usage?: {prompt_tokens?: number; completion_tokens?: number};
      };
      const parsed = schema.parse(JSON.parse(payload.choices[0]?.message.content ?? '{}'));
      return {
        data: parsed,
        usage: {
          inputTokens: payload.usage?.prompt_tokens ?? 0,
          outputTokens: payload.usage?.completion_tokens ?? 0
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
