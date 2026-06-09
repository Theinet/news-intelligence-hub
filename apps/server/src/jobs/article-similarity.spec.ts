import {articleSimilarityScore, SimilarityArticle} from './article-similarity';

function article(partial: Partial<SimilarityArticle>): SimilarityArticle {
  return {
    id: partial.id ?? 'article',
    title: partial.title ?? '',
    content: partial.content ?? '',
    summary: partial.summary,
    categories: partial.categories ?? [],
    entityIds: partial.entityIds ?? []
  };
}

describe('articleSimilarityScore', () => {
  it('scores related infrastructure articles above the default threshold', () => {
    const left = article({
      title: 'Microsoft ships new AI runtime for developers',
      content: 'Microsoft and OpenAI released an AI infrastructure runtime for enterprise teams.',
      categories: ['AI infrastructure'],
      entityIds: ['microsoft', 'openai']
    });
    const right = article({
      title: 'OpenAI and Microsoft improve AI infrastructure tooling',
      content: 'The release focuses on production AI runtime observability for developers.',
      categories: ['AI infrastructure'],
      entityIds: ['microsoft', 'openai']
    });

    expect(articleSimilarityScore(left, right)).toBeGreaterThanOrEqual(0.22);
  });

  it('keeps unrelated articles below the default threshold', () => {
    const crypto = article({
      title: 'EU crypto regulation update mentions Bitcoin',
      content: 'The European Union published compliance rules for crypto asset projects.',
      categories: ['Crypto regulation'],
      entityIds: ['bitcoin', 'eu']
    });
    const devTools = article({
      title: 'Anthropic expands DevTools guidance',
      content: 'The guidance discusses prompt design and evaluation for engineering teams.',
      categories: ['DevTools'],
      entityIds: ['anthropic']
    });

    expect(articleSimilarityScore(crypto, devTools)).toBeLessThan(0.22);
  });

  it('handles malformed categories without throwing', () => {
    const score = articleSimilarityScore(
      article({title: 'AI runtime', content: 'Microsoft OpenAI runtime', categories: null}),
      article({title: 'AI runtime', content: 'Microsoft OpenAI runtime', categories: {name: 'AI'}})
    );

    expect(score).toBeGreaterThan(0);
  });
});
