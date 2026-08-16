export function normalizeLocalSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim()
}

export function localSearchTokens(query: string): string[] {
  const normalized = normalizeLocalSearchText(query)
  return normalized ? normalized.split(' ').filter(Boolean) : []
}

export function localSearchTextMatches(searchableText: string, query: string): boolean {
  const tokens = localSearchTokens(query)
  if (tokens.length === 0) return true

  const searchable = normalizeLocalSearchText(searchableText)
  return tokens.every((token) => searchable.includes(token))
}

export function filterByLocalSearch<T>(
  items: T[],
  query: string,
  searchableText: (item: T) => string,
): T[] {
  const tokens = localSearchTokens(query)
  if (tokens.length === 0) return items
  return items.filter((item) => {
    const searchable = normalizeLocalSearchText(searchableText(item))
    return tokens.every((token) => searchable.includes(token))
  })
}
