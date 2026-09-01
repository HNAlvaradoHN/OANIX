import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const TEXT_BLOCK_KIND = 'text-segment'
export const MAX_TEXT_BLOCK_TEXT_LENGTH = 200_000

export interface EditorTextBlock {
  id: string
  kind: typeof TEXT_BLOCK_KIND
  text: string
}

/**
 * A plain-text segment that participates in the encrypted rich-block order.
 * Legacy note text remains outside this contract until a user explicitly
 * creates or edits a new segment, avoiding automatic migration writes.
 */
export function decodeTextBlock(block: EditorSurfaceBlock): EditorTextBlock | null {
  if (block.kind !== TEXT_BLOCK_KIND) return null

  const { text } = block.data
  if (typeof text !== 'string' || text.length > MAX_TEXT_BLOCK_TEXT_LENGTH) return null

  return {
    id: block.id,
    kind: TEXT_BLOCK_KIND,
    text,
  }
}

export function encodeTextBlock(block: EditorTextBlock): EditorSurfaceBlock {
  return {
    id: block.id,
    kind: TEXT_BLOCK_KIND,
    data: { text: block.text },
  }
}
