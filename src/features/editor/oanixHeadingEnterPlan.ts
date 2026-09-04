import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'
import { decodeTextBlock, encodeTextBlock, TEXT_BLOCK_KIND, type EditorTextBlockFormat } from './textBlockCodec.ts'

export function buildHeadingEnterPlan(
  blocks: readonly EditorSurfaceBlock[],
  targetId: string,
  selectionStart: number,
  selectionEnd: number,
  createId: () => string = () => `oanix-text-${crypto.randomUUID()}`,
  liveText?: string,
  liveFormat?: EditorTextBlockFormat,
) {
  const index = blocks.findIndex((block) => block.id === targetId)
  if (index < 0) return null
  const target = decodeTextBlock(blocks[index])
  if (!target) return null

  const headingFormat = liveFormat ?? target.format
  if (headingFormat !== 'h2' && headingFormat !== 'h3') return null

  const sourceText = liveText ?? target.text
  const start = Math.max(0, Math.min(selectionStart, selectionEnd, sourceText.length))
  const end = Math.max(start, Math.min(Math.max(selectionStart, selectionEnd), sourceText.length))
  const paragraphId = createId()
  const heading = encodeTextBlock({
    id: target.id,
    kind: TEXT_BLOCK_KIND,
    text: sourceText.slice(0, start),
    format: headingFormat,
  })
  const paragraph = encodeTextBlock({
    id: paragraphId,
    kind: TEXT_BLOCK_KIND,
    text: sourceText.slice(end),
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

export function buildHeadingParagraphReset(
  blocks: readonly EditorSurfaceBlock[],
  targetId: string,
  liveText = '',
) {
  const targetBlock = blocks.find((block) => block.id === targetId)
  const target = targetBlock ? decodeTextBlock(targetBlock) : null
  if (!target) return null

  return encodeTextBlock({
    id: target.id,
    kind: TEXT_BLOCK_KIND,
    text: liveText,
    format: 'paragraph',
  })
}
