export interface RichTextRun {
  text: string
  bold?: boolean
  italic?: boolean
  href?: string
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

export interface ListBlock {
  id: string
  type: 'bulletList' | 'orderedList'
  items: RichTextRun[][]
}

export interface DividerBlock {
  id: string
  type: 'divider'
}

export type NoteBlock = ParagraphBlock | HeadingBlock | QuoteBlock | ListBlock | DividerBlock

export interface NoteRecord {
  version: 1
  id: string
  title: string
  createdAt: string
  updatedAt: string
  content: {
    format: 'blocks-v1'
    blocks: NoteBlock[]
  }
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

function isNoteBlock(value: unknown): value is NoteBlock {
  if (!value || typeof value !== 'object') return false

  const block = value as Partial<NoteBlock> & {
    id?: unknown
    type?: unknown
    runs?: unknown
    level?: unknown
    items?: unknown
  }

  if (typeof block.id !== 'string' || block.id.length === 0 || typeof block.type !== 'string') {
    return false
  }

  if (block.type === 'divider') return true

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
    !!note.content &&
    note.content.format === 'blocks-v1' &&
    Array.isArray(note.content.blocks) &&
    note.content.blocks.every(isNoteBlock)
  )
}

function runsToPlainText(runs: RichTextRun[]): string {
  return runs.map((run) => run.text).join('')
}

export function noteBlocksToPlainText(blocks: NoteBlock[]): string {
  return blocks
    .flatMap((block) => {
      if (block.type === 'divider') return []
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        return block.items.map(runsToPlainText)
      }
      return [runsToPlainText(block.runs)]
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
