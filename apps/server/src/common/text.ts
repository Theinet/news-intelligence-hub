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

export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
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
