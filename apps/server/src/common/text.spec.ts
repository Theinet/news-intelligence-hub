import {decodeHtmlEntities, stripHtml} from './text';

describe('decodeHtmlEntities', () => {
  it('decodes numeric quote entities', () => {
    expect(decodeHtmlEntities('Xbox warns of a &#8216;reset&#8217; as it prepares for layoffs'))
      .toBe('Xbox warns of a ‘reset’ as it prepares for layoffs');
  });

  it('decodes named entities', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry &quot;show&quot;')).toBe('Tom & Jerry "show"');
  });
});

describe('stripHtml', () => {
  it('strips tags and decodes entities', () => {
    expect(stripHtml('<p>Hello&nbsp;&amp; &#8216;world&#8217;</p>')).toBe('Hello & ‘world’');
  });
});
