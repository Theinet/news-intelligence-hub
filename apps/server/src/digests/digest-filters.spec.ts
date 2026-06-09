import {
  digestArticleMatchesFilters,
  digestPeriodStart,
  isDigestPeriod
} from './digest-filters';

describe('digest filters', () => {
  it('accepts only supported digest periods', () => {
    expect(isDigestPeriod('day')).toBe(true);
    expect(isDigestPeriod('week')).toBe(true);
    expect(isDigestPeriod('month')).toBe(true);
    expect(isDigestPeriod('year')).toBe(false);
  });

  it('calculates period windows from the supplied clock', () => {
    const now = new Date('2026-06-09T12:00:00.000Z');

    expect(digestPeriodStart('day', now).toISOString()).toBe('2026-06-08T12:00:00.000Z');
    expect(digestPeriodStart('week', now).toISOString()).toBe('2026-06-02T12:00:00.000Z');
    expect(digestPeriodStart('month', now).toISOString()).toBe('2026-05-10T12:00:00.000Z');
  });

  it('matches articles by selected categories and entities', () => {
    const article = {
      categories: ['AI infrastructure', 'DevTools'],
      mentions: [{entityId: 'ent_openai'}, {entityId: 'ent_ms'}]
    };

    expect(digestArticleMatchesFilters(article, ['DevTools'], [])).toBe(true);
    expect(digestArticleMatchesFilters(article, [], ['ent_openai'])).toBe(true);
    expect(digestArticleMatchesFilters(article, ['Crypto regulation'], [])).toBe(false);
    expect(digestArticleMatchesFilters(article, ['DevTools'], ['ent_bitcoin'])).toBe(false);
  });

  it('treats empty filter lists as no filtering', () => {
    expect(digestArticleMatchesFilters({categories: [], mentions: []}, [], [])).toBe(true);
  });
});
