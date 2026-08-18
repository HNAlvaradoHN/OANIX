export interface RichTextRun {
  text: string
  bold?: boolean
  italic?: boolean
  href?: string
}

export const CODE_LANGUAGES = [
  'plaintext',
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'json',
  'bash',
  'sql',
  'java',
  'cpp',
  'csharp',
  'kotlin',
  'swift',
  'php',
] as const

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]

export function normalizeCodeLanguage(value: unknown): CodeLanguage {
  return typeof value === 'string' && (CODE_LANGUAGES as readonly string[]).includes(value)
    ? (value as CodeLanguage)
    : 'plaintext'
}

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

export function normalizeImageMimeType(value: unknown): ImageMimeType | null {
  return typeof value === 'string' && (IMAGE_MIME_TYPES as readonly string[]).includes(value)
    ? (value as ImageMimeType)
    : null
}

export const IMAGE_ALIGNMENTS = ['left', 'center', 'right'] as const
export type ImageAlignment = (typeof IMAGE_ALIGNMENTS)[number]

export function normalizeImageAlignment(value: unknown): ImageAlignment | null {
  return typeof value === 'string' && (IMAGE_ALIGNMENTS as readonly string[]).includes(value)
    ? (value as ImageAlignment)
    : null
}

export interface ParagraphBlock {
  id: string
  type: 'paragraph'
  runs: RichTextRun[]
}

export interface HeadingBlock {
  id: string
  type: 'heading'
  level: 1 | 2 | 3
  runs: RichTextRun[]
}

export interface QuoteBlock {
  id: string
  type: 'quote'
  runs: RichTextRun[]
}

export interface BulletListBlock {
  id: string
  type: 'bulletList'
  items: RichTextRun[][]
}

export interface OrderedListBlock {
  id: string
  type: 'orderedList'
  items: RichTextRun[][]
}

export interface ChecklistItem {
  text: string
  checked: boolean
}

export interface ChecklistBlock {
  id: string
  type: 'checklist'
  items: ChecklistItem[]
}

export interface ContactBlock {
  id: string
  type: 'contact'
  name: string
  phone: string
  email: string
  organization: string
  notes: string
}

export interface DailyEntryBlock {
  id: string
  type: 'dailyEntry'
  date: string
  title: string
}

export interface DividerBlock {
  id: string
  type: 'divider'
}

export interface CodeBlock {
  id: string
  type: 'code'
  language: CodeLanguage
  text: string
}

export interface ImageBlock {
  id: string
  type: 'image'
  imageId: string
  mimeType: ImageMimeType
  name: string
  byteLength: number
  alt?: string
  widthPercent?: number
  alignment?: ImageAlignment
  locked?: boolean
  showName?: boolean
}

export type NoteBlock =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | BulletListBlock
  | OrderedListBlock
  | ChecklistBlock
  | ContactBlock
  | DailyEntryBlock
  | DividerBlock
  | CodeBlock

export type StoredNoteBlock = NoteBlock | ImageBlock

export interface NoteRecord {
  version: 1
  id: string
  title: string
  createdAt: string
  updatedAt: string
  folderId?: string | null
  tagIds?: string[]
  pinned?: boolean
  manualOrder?: number
  content: {
    format: 'blocks-v1'
    blocks: StoredNoteBlock[]
  }
}

export function compareNotesForList(left: NoteRecord, right: NoteRecord): number {
  const leftPinned = left.pinned === true
  const rightPinned = right.pinned === true
  if (leftPinned !== rightPinned) return leftPinned ? -1 : 1

  const leftHasManualOrder = Number.isSafeInteger(left.manualOrder)
  const rightHasManualOrder = Number.isSafeInteger(right.manualOrder)

  if (leftHasManualOrder && rightHasManualOrder && left.manualOrder !== right.manualOrder) {
    return (right.manualOrder ?? 0) - (left.manualOrder ?? 0)
  }
  if (leftHasManualOrder !== rightHasManualOrder) return leftHasManualOrder ? -1 : 1

  const modifiedComparison = right.updatedAt.localeCompare(left.updatedAt)
  return modifiedComparison || left.id.localeCompare(right.id)
}

export function normalizeNoteLink(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed

  try {
    const url = new URL(candidate)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol.toLowerCase())
      ? candidate
      : null
  } catch {
    return null
  }
}

function isRichTextRun(value: unknown): value is RichTextRun {
  if (!value || typeof value !== 'object') return false

  const run = value as Partial<RichTextRun>
  return (
    typeof run.text === 'string' &&
    (run.bold === undefined || typeof run.bold === 'boolean') &&
    (run.italic === undefined || typeof run.italic === 'boolean') &&
    (run.href === undefined ||
      (typeof run.href === 'string' && normalizeNoteLink(run.href) === run.href))
  )
}

function isRunArray(value: unknown): value is RichTextRun[] {
  return Array.isArray(value) && value.every(isRichTextRun)
}

function isChecklistItem(value: unknown): value is ChecklistItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ChecklistItem>
  return typeof item.text === 'string' && typeof item.checked === 'boolean'
}

function isStoredNoteBlock(value: unknown): value is StoredNoteBlock {
  if (!value || typeof value !== 'object') return false

  const block = value as {
    id?: unknown
    type?: unknown
    runs?: unknown
    level?: unknown
    items?: unknown
    language?: unknown
    text?: unknown
    imageId?: unknown
    mimeType?: unknown
    name?: unknown
    byteLength?: unknown
    alt?: unknown
    widthPercent?: unknown
    alignment?: unknown
    locked?: unknown
    showName?: unknown
    phone?: unknown
    email?: unknown
    organization?: unknown
    notes?: unknown
    date?: unknown
    title?: unknown
  }

  if (typeof block.id !== 'string' || block.id.length === 0 || typeof block.type !== 'string') {
    return false
  }

  if (block.type === 'divider') return true

  if (block.type === 'code') {
    return (
      typeof block.text === 'string' &&
      typeof block.language === 'string' &&
      normalizeCodeLanguage(block.language) === block.language
    )
  }

  if (block.type === 'image') {
    return (
      typeof block.imageId === 'string' &&
      block.imageId.length > 0 &&
      normalizeImageMimeType(block.mimeType) !== null &&
      typeof block.name === 'string' &&
      typeof block.byteLength === 'number' &&
      Number.isSafeInteger(block.byteLength) &&
      block.byteLength >= 0 &&
      (block.alt === undefined || typeof block.alt === 'string') &&
      (block.widthPercent === undefined ||
        (typeof block.widthPercent === 'number' &&
          Number.isSafeInteger(block.widthPercent) &&
          block.widthPercent >= 10 &&
          block.widthPercent <= 100)) &&
      (block.alignment === undefined || normalizeImageAlignment(block.alignment) !== null) &&
      (block.locked === undefined || typeof block.locked === 'boolean') &&
      (block.showName === undefined || typeof block.showName === 'boolean')
    )
  }

  if (block.type === 'checklist') {
    return Array.isArray(block.items) && block.items.every(isChecklistItem)
  }

  if (block.type === 'contact') {
    return (
      typeof block.name === 'string' &&
      typeof block.phone === 'string' &&
      typeof block.email === 'string' &&
      typeof block.organization === 'string' &&
      typeof block.notes === 'string'
    )
  }

  if (block.type === 'dailyEntry') {
    return (
      typeof block.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(block.date) &&
      typeof block.title === 'string'
    )
  }

  if (block.type === 'paragraph' || block.type === 'quote') {
    return isRunArray(block.runs)
  }

  if (block.type === 'heading') {
    return (
      (block.level === 1 || block.level === 2 || block.level === 3) &&
      isRunArray(block.runs)
    )
  }

  if (block.type === 'bulletList' || block.type === 'orderedList') {
    return Array.isArray(block.items) && block.items.every(isRunArray)
  }

  return false
}

export function isNoteRecord(value: unknown): value is NoteRecord {
  if (!value || typeof value !== 'object') return false

  const note = value as Partial<NoteRecord>
  return (
    note.version === 1 &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string' &&
    (note.folderId === undefined || note.folderId === null || typeof note.folderId === 'string') &&
    (note.tagIds === undefined ||
      (Array.isArray(note.tagIds) &&
        note.tagIds.every((tagId) => typeof tagId === 'string' && tagId.length > 0) &&
        new Set(note.tagIds).size === note.tagIds.length)) &&
    (note.pinned === undefined || typeof note.pinned === 'boolean') &&
    (note.manualOrder === undefined ||
      (Number.isSafeInteger(note.manualOrder) && (note.manualOrder ?? -1) >= 0)) &&
    !!note.content &&
    note.content.format === 'blocks-v1' &&
    Array.isArray(note.content.blocks) &&
    note.content.blocks.every(isStoredNoteBlock)
  )
}

function runsToPlainText(runs: RichTextRun[]): string {
  return runs.map((run) => run.text).join('')
}

/**
 * List-safe secondary label. It intentionally exposes only the title of the most
 * recent daily entry. Note body text, contacts, code and image metadata never
 * become a list preview.
 */
export function noteBlocksToPlainText(blocks: StoredNoteBlock[]): string {
  const latestEntry = [...blocks].reverse().find((block) => block.type === 'dailyEntry')
  return latestEntry?.type === 'dailyEntry' ? latestEntry.title.trim() : ''
}

/** Full plaintext representation for explicit user actions such as Share note. */
export function noteBlocksToFullPlainText(blocks: StoredNoteBlock[]): string {
  return blocks
    .flatMap((block) => {
      if (block.type === 'divider') return []
      if (block.type === 'code') return [block.text]
      if (block.type === 'image') {
        const description = block.alt?.trim()
        if (description) return [description]
        return [block.showName === false ? 'Imagen' : block.name]
      }
      if (block.type === 'checklist') {
        return block.items.map((item) => `${item.checked ? '☑' : '☐'} ${item.text}`.trimEnd())
      }
      if (block.type === 'contact') {
        return [block.name, block.phone, block.email, block.organization, block.notes]
          .map((value) => value.trim())
          .filter(Boolean)
      }
      if (block.type === 'dailyEntry') {
        return block.title.trim() ? [block.title.trim()] : []
      }
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        return block.items.map(runsToPlainText)
      }
      return [runsToPlainText(block.runs)]
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
