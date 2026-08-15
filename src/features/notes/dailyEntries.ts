import type { DailyEntryBlock, NoteRecord, ParagraphBlock, StoredNoteBlock } from './noteTypes'

function createBlockId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDailyEntryDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const value = new Date(year, Math.max(0, month - 1), day, 12, 0, 0)
  if (Number.isNaN(value.getTime())) return dateKey

  const label = new Intl.DateTimeFormat('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value)

  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function createDailyEntryBlocks(date: Date = new Date()): [DailyEntryBlock, ParagraphBlock] {
  return [
    { id: createBlockId(), type: 'dailyEntry', date: localDateKey(date), title: '' },
    { id: createBlockId(), type: 'paragraph', runs: [] },
  ]
}

function cloneBlocks(blocks: StoredNoteBlock[]): StoredNoteBlock[] {
  return structuredClone(blocks)
}

export function prepareDailyEntriesForEditing(
  note: Pick<NoteRecord, 'createdAt' | 'content'>,
  now: Date = new Date(),
): StoredNoteBlock[] {
  const blocks = cloneBlocks(note.content.blocks)
  const firstEntryIndex = blocks.findIndex((block) => block.type === 'dailyEntry')

  if (firstEntryIndex < 0) {
    const created = new Date(note.createdAt)
    const firstDate = Number.isNaN(created.getTime()) ? now : created
    const [entry] = createDailyEntryBlocks(firstDate)
    blocks.unshift(entry)
  }

  const today = localDateKey(now)
  const lastEntry = [...blocks].reverse().find((block) => block.type === 'dailyEntry')

  if (!lastEntry || lastEntry.type !== 'dailyEntry' || lastEntry.date !== today) {
    const [entry, paragraph] = createDailyEntryBlocks(now)
    blocks.push(entry, paragraph)
  } else if (blocks.at(-1)?.type === 'dailyEntry') {
    blocks.push({ id: createBlockId(), type: 'paragraph', runs: [] })
  }

  return blocks
}
