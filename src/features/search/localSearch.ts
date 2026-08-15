import { noteBlocksToPlainText, type NoteRecord } from '../notes/noteTypes'

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

export function noteMatchesLocalSearch(note: NoteRecord, query: string): boolean {
  const tokens = localSearchTokens(query)
  if (tokens.length === 0) return true

  const searchable = normalizeLocalSearchText(
    `${note.title}\n${noteBlocksToPlainText(note.content.blocks)}`,
  )

  return tokens.every((token) => searchable.includes(token))
}

export function filterNotesByLocalSearch(notes: NoteRecord[], query: string): NoteRecord[] {
  const tokens = localSearchTokens(query)
  if (tokens.length === 0) return notes
  return notes.filter((note) => noteMatchesLocalSearch(note, query))
}
