import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const DAILY_ENTRY_BLOCK_KIND = 'dailyEntry'
export const MAX_DAILY_ENTRY_TITLE_LENGTH = 120
export const MAX_DAILY_ENTRY_TEXT_LENGTH = 20_000

export interface EditorDailyEntryBlock {
  id: string
  kind: typeof DAILY_ENTRY_BLOCK_KIND
  date: string
  title: string
  text: string
}

export function localDailyEntryDateKey(date: Date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isValidDailyEntryDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false

  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function formatDailyEntryDate(value: string): string {
  if (!isValidDailyEntryDate(value)) return value
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  const label = new Intl.DateTimeFormat('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function decodeDailyEntryBlock(block: EditorSurfaceBlock): EditorDailyEntryBlock | null {
  if (block.kind !== DAILY_ENTRY_BLOCK_KIND) return null
  const date = typeof block.data.date === 'string' ? block.data.date : ''
  const title = typeof block.data.title === 'string' ? block.data.title : ''
  const text = typeof block.data.text === 'string' ? block.data.text : ''
  if (!isValidDailyEntryDate(date)) return null
  if (title.length > MAX_DAILY_ENTRY_TITLE_LENGTH || text.length > MAX_DAILY_ENTRY_TEXT_LENGTH) return null
  return { id: block.id, kind: DAILY_ENTRY_BLOCK_KIND, date, title, text }
}

export function encodeDailyEntryBlock(block: EditorDailyEntryBlock): EditorSurfaceBlock {
  if (!isValidDailyEntryDate(block.date)) throw new Error('Invalid daily entry date')
  return {
    id: block.id,
    kind: DAILY_ENTRY_BLOCK_KIND,
    data: {
      date: block.date,
      title: block.title.slice(0, MAX_DAILY_ENTRY_TITLE_LENGTH),
      text: block.text.slice(0, MAX_DAILY_ENTRY_TEXT_LENGTH),
    },
  }
}
