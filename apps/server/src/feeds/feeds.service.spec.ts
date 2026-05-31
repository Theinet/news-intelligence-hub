import {extractFeedLinks} from './feeds.service';

describe('extractFeedLinks', () => {
  it('finds RSS and Atom alternate links in a source page', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/source/feed/" />
      <link rel="alternate" type="application/atom+xml" href="/source/topics/ai/feed/" />
      <link rel="stylesheet" href="/asset.css" />
    `;

    expect(extractFeedLinks(html, new URL('https://news.microsoft.com/source/topics/ai/'))
      .map((url) => url.toString())).toEqual([
      'https://news.microsoft.com/source/feed/',
      'https://news.microsoft.com/source/topics/ai/feed/'
    ]);
  });

  it('ignores non-feed alternate links', () => {
    const html = '<link rel="alternate" type="application/json" href="/wp-json/" />';

    expect(extractFeedLinks(html, new URL('https://example.com/page'))).toEqual([]);
  });
});
