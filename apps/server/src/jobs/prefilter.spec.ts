import {prefilterArticle} from './prefilter';

describe('prefilterArticle', () => {
  beforeEach(() => {
    process.env.MIN_ARTICLE_CHARS = '20';
    process.env.SEO_SPAM_TERMS = 'casino,betting,loan';
  });

  it('rejects short content before any LLM call', () => {
    expect(prefilterArticle('short')).toEqual({accepted: false, reason: 'too_short:5'});
  });

  it('rejects obvious SEO spam', () => {
    const result = prefilterArticle('casino betting article with enough text to pass length');
    expect(result.accepted).toBe(false);
  });

  it('accepts normal technical text', () => {
    const result = prefilterArticle('Microsoft released a technical update for AI infrastructure.');
    expect(result.accepted).toBe(true);
  });
});
