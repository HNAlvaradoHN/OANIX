import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const SEPARATOR_BLOCK_KIND = 'separator'

export interface EditorSeparatorBlock {
  id: string
  kind: typeof SEPARATOR_BLOCK_KIND
}

export function decodeSeparatorBlock(block: EditorSurfaceBlock): EditorSeparatorBlock | null {
  if (block.kind !== SEPARATOR_BLOCK_KIND) return null
  return { id: block.id, kind: SEPARATOR_BLOCK_KIND }
}

export function encodeSeparatorBlock(block: EditorSeparatorBlock): EditorSurfaceBlock {
  return {
    id: block.id,
    kind: SEPARATOR_BLOCK_KIND,
    data: {},
  }
}
