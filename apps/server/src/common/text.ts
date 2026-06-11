const translitMap: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  д: 'd',
  е: 'e',
  ё: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ы: 'y',
  э: 'e',
  ю: 'iu',
  я: 'ia',
  ь: '',
  ъ: ''
};

const aliases: Record<string, string> = {
  ms: 'microsoft',
  msft: 'microsoft',
  'microsoft corp': 'microsoft',
  'microsoft corporation': 'microsoft',
  майкрософт: 'microsoft'
};

const namedHtmlEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  rsquo: '\u2019',
  lsquo: '\u2018',
  ldquo: '\u201C',
  rdquo: '\u201D',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013'
};

export function decodeHtmlEntities(value: string): string {
  if (!value.includes('&')) {
    return value;
  }
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/giu, (entity, body) => {
    if (body[0] === '#') {
      const isHex = body[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
        return entity;
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    }
    return namedHtmlEntities[body.toLowerCase()] ?? entity;
  });
}

export function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/giu, ' ')
      .replace(/<style[\s\S]*?<\/style>/giu, ' ')
      .replace(/<[^>]+>/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
  ).replace(/\u00A0/gu, ' ');
}

export function normalizeEntityName(value: string): string {
  const plain = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .replace(/\b(corp|corporation|inc|llc|ltd|plc)\b/giu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const transliterated = plain.replace(/[а-яёєіїґ]/giu, (letter) => {
    return translitMap[letter.toLowerCase()] ?? letter;
  });
  return aliases[plain] ?? aliases[transliterated] ?? transliterated;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
