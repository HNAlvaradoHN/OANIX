import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'
import { decodeTextBlock, encodeTextBlock, TEXT_BLOCK_KIND } from './textBlockCodec.ts'

export function buildHeadingEnterPlan(
  blocks: readonly EditorSurfaceBlock[],
  targetId: string,
  selectionStart: number,
  selectionEnd: number,
  createId: () => string = () => `oanix-text-${crypto.randomUUID()}`,
) {
  const index = blocks.findIndex((block) => block.id === targetId)
  if (index < 0) return null
  const target = decodeTextBlock(blocks[index])
  if (!target || (target.format !== 'h2' && target.format !== 'h3')) return null

  const start = Math.max(0, Math.min(selectionStart, selectionEnd, target.text.length))
  const end = Math.max(start, Math.min(Math.max(selectionStart, selectionEnd), target.text.length))
  const paragraphId = createId()
  const heading = encodeTextBlock({
    id: target.id,
    kind: TEXT_BLOCK_KIND,
    text: target.text.slice(0, start),
    format: target.format,
  })
  const paragraph = encodeTextBlock({
    id: paragraphId,
    kind: TEXT_BLOCK_KIND,
    text: target.text.slice(end),
    format: 'paragraph',
  })
  const nextBlocks = [
    ...blocks.slice(0, index),
    heading,
    paragraph,
    ...blocks.slice(index + 1),
  ]
  return { heading, paragraph, paragraphId, order: nextBlocks.map((block) => block.id) }
}
