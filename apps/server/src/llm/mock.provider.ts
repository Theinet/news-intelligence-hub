import {estimateTokens} from '../common/text';
import {
  ArticleAnalysisInput,
  ArticleAnalysisResult,
  DigestInput,
  DigestResult,
  LlmProvider,
  LlmProviderResult
} from './contracts';

const knownEntities = [
  {name: 'Microsoft', type: 'company', aliases: ['MSFT', 'Microsoft Corp.', 'MS']},
  {name: 'OpenAI', type: 'company', aliases: []},
  {name: 'Anthropic', type: 'company', aliases: []},
  {name: 'React', type: 'technology', aliases: []},
  {name: 'PostgreSQL', type: 'technology', aliases: ['Postgres']},
  {name: 'Bitcoin', type: 'project', aliases: ['BTC']},
  {name: 'Ethereum', type: 'project', aliases: ['ETH']},
  {name: 'European Union', type: 'location', aliases: ['EU']}
] as const;

export class MockProvider implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'deterministic-dev';

  async analyzeArticle(
    input: ArticleAnalysisInput
  ): Promise<LlmProviderResult<ArticleAnalysisResult>> {
    const text = `${input.title}\n${input.content}`;
    const lower = text.toLowerCase();
    const entities = knownEntities
      .filter((entity) => {
        return [entity.name, ...entity.aliases].some((alias) => lower.includes(alias.toLowerCase()));
      })
      .map((entity) => ({
        name: entity.name,
        type: entity.type,
        aliases: [...entity.aliases],
        description: `${entity.name} mentioned in this article.`
      }));
    const categories = input.categories.filter((category) => {
      return lower.includes(category.toLowerCase().split(' ')[0]);
    });
    const axes = Object.fromEntries(input.axes.map((axis) => [axis.name, axis.values[0] ?? 'unknown']));
    const summary = input.content.slice(0, 220).replace(/\s+/gu, ' ');
    const result: ArticleAnalysisResult = {
      entities,
      summary,
      fullSummary: `${summary}${input.content.length > 220 ? '...' : ''}`,
      importance: entities.length >= 2 ? 'high' : 'normal',
      categories: categories.length > 0 ? categories : input.categories.slice(0, 1),
      axes
    };
    return {
      data: result,
      usage: {inputTokens: estimateTokens(text), outputTokens: estimateTokens(JSON.stringify(result))}
    };
  }

  async buildDigest(input: DigestInput): Promise<LlmProviderResult<DigestResult>> {
    const summary = [
      `Digest for ${input.period}.`,
      `Top entities: ${input.topEntities.map((item) => item.name).join(', ') || 'none'}.`,
      `Key articles: ${input.keyArticles.map((item) => item.title).slice(0, 3).join('; ') || 'none'}.`
    ].join(' ');
    return {
      data: {summary},
      usage: {inputTokens: estimateTokens(JSON.stringify(input)), outputTokens: estimateTokens(summary)}
    };
  }
}
