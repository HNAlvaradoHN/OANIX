export interface LocalSearchField {
  key: string
  label: string
  text: string
}

export interface LocalSearchMatch {
  key: string
  label: string
  snippet: string
  occurrences: number
}

export interface LocalSearchResult<T> {
  item: T
  matches: LocalSearchMatch[]
  totalOccurrences: number
}

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

function countTokenOccurrences(text: string, token: string): number {
  if (!token) return 0
  let count = 0
  let offset = 0

  while (offset < text.length) {
    const index = text.indexOf(token, offset)
    if (index < 0) break
    count += 1
    offset = index + Math.max(token.length, 1)
  }

  return count
}

function localSearchSnippet(text: string, tokens: string[]): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return ''

  const normalized = normalizeLocalSearchText(compact)
  const indexes = tokens
    .map((token) => normalized.indexOf(token))
    .filter((index) => index >= 0)
  const firstMatch = indexes.length > 0 ? Math.min(...indexes) : 0
  const radius = 58
  const start = Math.max(0, firstMatch - radius)
  const end = Math.min(compact.length, firstMatch + radius + 72)
  const snippet = compact.slice(start, end).trim()

  return `${start > 0 ? '…' : ''}${snippet}${end < compact.length ? '…' : ''}`
}

export function findLocalSearchMatches(
  fields: LocalSearchField[],
  query: string,
): LocalSearchMatch[] {
  const tokens = localSearchTokens(query)
  if (tokens.length === 0) return []

  const normalizedFields = fields.map((field) => ({
    field,
    normalized: normalizeLocalSearchText(field.text),
  }))
  const combined = normalizedFields.map(({ normalized }) => normalized).join('\n')

  if (!tokens.every((token) => combined.includes(token))) return []

  return normalizedFields.flatMap(({ field, normalized }) => {
    const occurrences = tokens.reduce(
      (total, token) => total + countTokenOccurrences(normalized, token),
      0,
    )
    if (occurrences === 0) return []

    return [{
      key: field.key,
      label: field.label,
      snippet: localSearchSnippet(field.text, tokens),
      occurrences,
    }]
  })
}

export function searchItemsByLocalFields<T>(
  items: T[],
  query: string,
  fieldsForItem: (item: T) => LocalSearchField[],
): LocalSearchResult<T>[] {
  const tokens = localSearchTokens(query)
  if (tokens.length === 0) return []

  return items.flatMap((item) => {
    const matches = findLocalSearchMatches(fieldsForItem(item), query)
    if (matches.length === 0) return []

    return [{
      item,
      matches,
      totalOccurrences: matches.reduce((total, match) => total + match.occurrences, 0),
    }]
  })
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
