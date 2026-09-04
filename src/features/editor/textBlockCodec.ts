import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const TEXT_BLOCK_KIND = 'text-segment'
export const MAX_TEXT_BLOCK_TEXT_LENGTH = 200_000

export type EditorTextBlockFormat = 'paragraph' | 'h2' | 'h3' | 'quote' | 'list' | 'numbered-list'

const TEXT_BLOCK_FORMATS = new Set<EditorTextBlockFormat>([
  'paragraph',
  'h2',
  'h3',
  'quote',
  'list',
  'numbered-list',
])

export interface EditorTextBlock {
  id: string
  kind: typeof TEXT_BLOCK_KIND
  text: string
  /** Omitted historical/new helper values are persisted as paragraph. */
  format?: EditorTextBlockFormat
}

function decodeFormat(value: unknown): EditorTextBlockFormat | null {
  if (value === undefined) return 'paragraph'
  if (typeof value !== 'string') return null
  return TEXT_BLOCK_FORMATS.has(value as EditorTextBlockFormat) ? value as EditorTextBlockFormat : null
}

/**
 * A plain-text segment that participates in the encrypted rich-block order.
 * Legacy segments without a persisted format decode as paragraph, preserving
 * historical notes without a migration write.
 */
export function decodeTextBlock(block: EditorSurfaceBlock): EditorTextBlock | null {
  if (block.kind !== TEXT_BLOCK_KIND) return null

  const { text, format } = block.data
  if (typeof text !== 'string' || text.length > MAX_TEXT_BLOCK_TEXT_LENGTH) return null
  const decodedFormat = decodeFormat(format)
  if (!decodedFormat) return null

  return {
    id: block.id,
    kind: TEXT_BLOCK_KIND,
    text,
    format: decodedFormat,
  }
}

export function encodeTextBlock(block: EditorTextBlock): EditorSurfaceBlock {
  const format = block.format ?? 'paragraph'
  return {
    id: block.id,
    kind: TEXT_BLOCK_KIND,
    data: format === 'paragraph'
      ? { text: block.text }
      : { text: block.text, format },
  }
}
