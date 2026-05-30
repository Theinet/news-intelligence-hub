import {categoryMatchesQuery} from './category-filter';

describe('categoryMatchesQuery', () => {
  it('matches any dynamic category by the start of a word', () => {
    expect(categoryMatchesQuery(['DevTools from Ukrainian founders'], 'D')).toBe(true);
    expect(categoryMatchesQuery(['DevTools from Ukrainian founders'], 'ukr')).toBe(true);
  });

  it('matches multi-word category prefixes', () => {
    expect(categoryMatchesQuery(['AI infrastructure'], 'ai in')).toBe(true);
    expect(categoryMatchesQuery(['Crypto regulation'], 'crypto r')).toBe(true);
  });

  it('does not match letters in the middle of a word', () => {
    expect(categoryMatchesQuery(['Crypto regulation'], 'a')).toBe(false);
  });

  it('treats empty queries as no filter', () => {
    expect(categoryMatchesQuery(['Anything'], '   ')).toBe(true);
  });
});
