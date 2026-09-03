import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
} from './editorSurfaceContract.ts'
import { encodeOanixImageElement } from './oanixImageElementCodec.ts'
import { decodeTextBlock, encodeTextBlock } from './textBlockCodec.ts'

export interface OanixMixedImageInsertionPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  imageBlockId: string
  beforeTextBlockId: string
  afterTextBlockId: string
}

interface OanixMixedImageInsertionPlanOptions {
  blocks: readonly EditorSurfaceBlock[]
  targetTextBlockId: string
  cursorOffset: number
  attachmentId: string
  createId?: (kind: 'text' | 'image', index: number) => string
}

function defaultCreateId(kind: 'text' | 'image'): string {
  return `oanix-${kind}-${crypto.randomUUID()}`
}

/**
 * Replaces exactly one existing mixed-document text segment with
 * text-before -> image -> text-after while preserving every neighboring block.
 *
 * Both text halves receive fresh ids. Mixed textareas are intentionally
 * uncontrolled; replacing the key guarantees React remounts the split segments
 * with their committed values instead of retaining the old DOM value.
 */
export function planOanixMixedImageInsertion({
  blocks,
  targetTextBlockId,
  cursorOffset,
  attachmentId,
  createId = defaultCreateId,
}: OanixMixedImageInsertionPlanOptions): OanixMixedImageInsertionPlan {
  if (!attachmentId) throw new Error('Mixed image insertion requires an attachment id.')

  const targetIndex = blocks.findIndex((block) => block.id === targetTextBlockId)
  if (targetIndex < 0) throw new Error('Target text block was not found.')

  const target = decodeTextBlock(blocks[targetIndex])
  if (!target) throw new Error('Target block is not a supported text segment.')

  const safeCursor = Math.min(Math.max(0, cursorOffset), target.text.length)
  const beforeTextBlockId = createId('text', 0)
  const imageBlockId = createId('image', 0)
  const afterTextBlockId = createId('text', 1)

  const beforeBlock = encodeTextBlock({
    id: beforeTextBlockId,
    kind: target.kind,
    text: target.text.slice(0, safeCursor),
  })
  const imageBlock = encodeOanixImageElement({
    id: imageBlockId,
    kind: 'oanix-image-element-v1',
    attachmentId,
  })
  const afterBlock = encodeTextBlock({
    id: afterTextBlockId,
    kind: target.kind,
    text: target.text.slice(safeCursor),
  })
  const nextBlocks = [
    ...blocks.slice(0, targetIndex),
    beforeBlock,
    imageBlock,
    afterBlock,
    ...blocks.slice(targetIndex + 1),
  ]

  return {
    blocks: nextBlocks,
    upserts: [beforeBlock, imageBlock, afterBlock],
    deletes: [targetTextBlockId],
    order: nextBlocks.map((block) => block.id),
    imageBlockId,
    beforeTextBlockId,
    afterTextBlockId,
  }
}

export type OanixMixedImageInsertionResult =
  | {
      status: 'committed'
      attachment: EditorSurfaceAttachment
      plan: OanixMixedImageInsertionPlan
    }
  | { status: 'store-failed' }
  | {
      status: 'block-save-failed'
      attachment: EditorSurfaceAttachment
      attachmentCleanupSucceeded: boolean
    }

interface InsertOanixImageIntoMixedDocumentOptions {
  file: File
  blocks: readonly EditorSurfaceBlock[]
  targetTextBlockId: string
  cursorOffset: number
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  createId?: (kind: 'text' | 'image', index: number) => string
}

/**
 * Transaction boundary for adding another image to an already mixed document.
 *
 * The asset is stored first because the document block needs its opaque id. The
 * segment replacement (3 upserts + 1 delete + order) is submitted as one block
 * change-set. If that commit fails, the newly-created asset is compensated; no
 * follow-up rollback rewrites existing document content.
 */
export async function insertOanixImageIntoMixedDocument({
  file,
  blocks,
  targetTextBlockId,
  cursorOffset,
  storeAttachment,
  saveBlockChanges,
  removeAttachment,
  createId,
}: InsertOanixImageIntoMixedDocumentOptions): Promise<OanixMixedImageInsertionResult> {
  let attachment: EditorSurfaceAttachment
  try {
    attachment = await storeAttachment(file)
  } catch {
    return { status: 'store-failed' }
  }

  let plan: OanixMixedImageInsertionPlan
  try {
    plan = planOanixMixedImageInsertion({
      blocks,
      targetTextBlockId,
      cursorOffset,
      attachmentId: attachment.id,
      createId,
    })
  } catch {
    let attachmentCleanupSucceeded = false
    try {
      attachmentCleanupSucceeded = await removeAttachment(attachment.id)
    } catch {
      attachmentCleanupSucceeded = false
    }
    return { status: 'block-save-failed', attachment, attachmentCleanupSucceeded }
  }

  let saved = false
  try {
    saved = await saveBlockChanges({
      upserts: plan.upserts,
      deletes: plan.deletes,
      order: plan.order,
    })
  } catch {
    saved = false
  }

  if (!saved) {
    let attachmentCleanupSucceeded = false
    try {
      attachmentCleanupSucceeded = await removeAttachment(attachment.id)
    } catch {
      attachmentCleanupSucceeded = false
    }
    return { status: 'block-save-failed', attachment, attachmentCleanupSucceeded }
  }

  return { status: 'committed', attachment, plan }
}
