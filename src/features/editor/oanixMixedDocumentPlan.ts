import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'
import { planOanixCursorInsertion } from './oanixDocumentInsertion.ts'
import { encodeOanixImageElement, type OanixImageElement } from './oanixImageElementCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  encodeTextBlock,
  type EditorTextBlock,
} from './textBlockCodec.ts'

export interface OanixMixedDocumentPlan {
  blocks: EditorSurfaceBlock[]
  order: string[]
  imageBlockId: string
  beforeText: string
  afterText: string
}

interface OanixMixedDocumentPlanOptions {
  text: string
  cursorOffset: number
  attachmentId: string
  createId?: (kind: 'text' | 'image', index: number) => string
}

function defaultCreateId(kind: 'text' | 'image'): string {
  return `oanix-${kind}-${crypto.randomUUID()}`
}

function chunkText(text: string): string[] {
  if (text.length === 0) return ['']
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; offset += MAX_TEXT_BLOCK_TEXT_LENGTH) {
    chunks.push(text.slice(offset, offset + MAX_TEXT_BLOCK_TEXT_LENGTH))
  }
  return chunks
}

/**
 * Builds the document shape required to place one atomic image at the native
 * textarea cursor without losing the continuous text around it.
 *
 * The result is deliberately pure: it does not mutate EditorBlockSession, save the
 * plain-text snapshot, or touch attachment storage. That separation is important
 * because those writes need one recoverable coordinator before the approved mobile
 * textarea can safely switch to mixed rendering.
 */
export function planOanixMixedDocumentImageInsertion({
  text,
  cursorOffset,
  attachmentId,
  createId = defaultCreateId,
}: OanixMixedDocumentPlanOptions): OanixMixedDocumentPlan {
  if (!attachmentId) throw new Error('Image insertion requires an attachment id.')

  const split = planOanixCursorInsertion(text, cursorOffset)
  let textIndex = 0
  const beforeBlocks = chunkText(split.beforeText).map((chunk): EditorTextBlock => ({
    id: createId('text', textIndex++),
    kind: TEXT_BLOCK_KIND,
    text: chunk,
  }))

  const image: OanixImageElement = {
    id: createId('image', 0),
    kind: 'oanix-image-element-v1',
    attachmentId,
  }

  const afterBlocks = chunkText(split.afterText).map((chunk): EditorTextBlock => ({
    id: createId('text', textIndex++),
    kind: TEXT_BLOCK_KIND,
    text: chunk,
  }))

  const blocks = [
    ...beforeBlocks.map(encodeTextBlock),
    encodeOanixImageElement(image),
    ...afterBlocks.map(encodeTextBlock),
  ]

  return {
    blocks,
    order: blocks.map((block) => block.id),
    imageBlockId: image.id,
    beforeText: split.beforeText,
    afterText: split.afterText,
  }
}
