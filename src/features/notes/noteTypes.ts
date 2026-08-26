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

export const NOTE_VISUAL_ICONS = [
  '📝', '💡', '📊', '🎨', '📈', '🚀', '⚡', '🔥', '💎', '🎵',
  '🎮', '📁', '💻', '🏃', '🔄', '💬', '⚙️', '⭐', '📌', '🎯',
  '🧠', '✅', '📚', '🧪',
] as const
export type NoteVisualIcon = (typeof NOTE_VISUAL_ICONS)[number]

export const NOTE_VISUAL_COLORS = [
  '#2563eb',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#64748b',
] as const

export const DEFAULT_NOTE_VISUAL_ICON: NoteVisualIcon = '📝'
export const DEFAULT_NOTE_VISUAL_COLOR = '#2563eb'
export const MAX_NOTE_VISUAL_DESCRIPTION_LENGTH = 140
const NOTE_VISUAL_COLOR = /^#[0-9a-f]{6}$/i

export function defaultNoteVisualColor(noteId: string): string {
  let hash = 2166136261
  for (let index = 0; index < noteId.length; index += 1) {
    hash ^= noteId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const paletteIndex = (hash >>> 0) % NOTE_VISUAL_COLORS.length
  return NOTE_VISUAL_COLORS[paletteIndex] ?? DEFAULT_NOTE_VISUAL_COLOR
}

export function isNoteVisualIcon(value: unknown): value is NoteVisualIcon {
  return typeof value === 'string' && (NOTE_VISUAL_ICONS as readonly string[]).includes(value)
}

export function isNoteVisualColor(value: unknown): value is string {
  return typeof value === 'string' && NOTE_VISUAL_COLOR.test(value)
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
  name: string
  alt?: string
  showName?: boolean
  alignment?: ImageAlignment
}

export type StoredNoteBlock =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | BulletListBlock
  | OrderedListBlock
  | ChecklistBlock
  | ContactBlock
  | DailyEntryBlock
  | CodeBlock
  | ImageBlock

export interface NoteContent {
  version: 1
  blocks: StoredNoteBlock[]
}

export interface NoteRecord {
  version: 1
  id: string
  title: string
  content: NoteContent
  folderId: string | null
  tagIds?: string[]
  pinned?: boolean
  manualOrder?: number
  visualDescription?: string
  visualCategoryTagId?: string
  visualIcon?: NoteVisualIcon
  visualColor?: string
  createdAt: string
  updatedAt: string
}

export function noteBlocksToPlainText(blocks: StoredNoteBlock[]): string {
  return blocks.map((block) => {
    if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') {
      return block.runs.map((run) => run.text).join('')
    }
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      return block.items.flatMap((item) => item.map((run) => run.text)).join('\n')
    }
    if (block.type === 'checklist') return block.items.map((item) => item.text).join('\n')
    if (block.type === 'contact') {
      return [block.name, block.phone, block.email, block.organization, block.notes].filter(Boolean).join('\n')
    }
    if (block.type === 'dailyEntry') return block.title
    if (block.type === 'code') return block.text
    if (block.type === 'image') return [block.showName === false ? '' : block.name, block.alt ?? ''].filter(Boolean).join('\n')
    return ''
  }).filter(Boolean).join('\n')
}

export function compareNotesForList(left: NoteRecord, right: NoteRecord): number {
  if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
  const leftOrder = Number.isSafeInteger(left.manualOrder) ? left.manualOrder as number : Number.MAX_SAFE_INTEGER
  const rightOrder = Number.isSafeInteger(right.manualOrder) ? right.manualOrder as number : Number.MAX_SAFE_INTEGER
  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return right.updatedAt.localeCompare(left.updatedAt)
}
