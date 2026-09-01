import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const CODE_BLOCK_KIND = 'code'
export const MAX_CODE_BLOCK_TEXT_LENGTH = 200_000
export const MAX_CODE_BLOCK_LANGUAGE_LENGTH = 40

export interface EditorCodeBlock {
  id: string
  kind: typeof CODE_BLOCK_KIND
  text: string
  language: string
}

/**
 * Keeps code blocks intentionally small: persisted data is plain text plus an
 * optional language hint. Rendering/highlighting remains a visual concern and
 * never changes the encrypted block contract.
 */
export function decodeCodeBlock(block: EditorSurfaceBlock): EditorCodeBlock | null {
  if (block.kind !== CODE_BLOCK_KIND) return null

  const { text, language } = block.data
  if (typeof text !== 'string' || typeof language !== 'string') return null
  if (text.length > MAX_CODE_BLOCK_TEXT_LENGTH) return null
  if (language.length > MAX_CODE_BLOCK_LANGUAGE_LENGTH) return null

  return {
    id: block.id,
    kind: CODE_BLOCK_KIND,
    text,
    language,
  }
}

export function encodeCodeBlock(block: EditorCodeBlock): EditorSurfaceBlock {
  return {
    id: block.id,
    kind: CODE_BLOCK_KIND,
    data: {
      text: block.text,
      language: block.language,
    },
  }
}
