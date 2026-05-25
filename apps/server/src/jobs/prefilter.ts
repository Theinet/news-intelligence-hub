import {envNumber} from '../common/env';

export interface PrefilterResult {
  accepted: boolean;
  reason?: string;
}

export function prefilterArticle(content: string): PrefilterResult {
  const text = content.trim();
  const minChars = envNumber('MIN_ARTICLE_CHARS', 600);
  if (text.length < minChars) {
    return {accepted: false, reason: `too_short:${text.length}`};
  }
  const spamTerms = (process.env.SEO_SPAM_TERMS ?? '')
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
  const lower = text.toLowerCase();
  const spamHits = spamTerms.filter((term) => lower.includes(term)).length;
  if (spamHits >= 2) {
    return {accepted: false, reason: 'seo_spam_terms'};
  }
  if ((lower.match(/click here|limited offer|sponsored/gu) ?? []).length >= 3) {
    return {accepted: false, reason: 'template_spam'};
  }
  return {accepted: true};
}
