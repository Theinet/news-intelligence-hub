function words(value: string): string[] {
  return value.toLowerCase().match(/\p{L}[\p{L}\p{N}]*/gu) ?? [];
}

export function categoryMatchesQuery(categories: string[], rawQuery?: string): boolean {
  const query = words(rawQuery ?? '').join(' ');
  if (!query) {
    return true;
  }
  return categories.some((category) => {
    const categoryWords = words(category);
    const categoryPhrase = categoryWords.join(' ');
    return categoryPhrase.startsWith(query) || categoryWords.some((word) => word.startsWith(query));
  });
}
