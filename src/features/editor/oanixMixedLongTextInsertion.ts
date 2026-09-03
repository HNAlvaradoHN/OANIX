import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
} from './editorSurfaceContract.ts'
import {
  OANIX_LONG_TEXT_ELEMENT_KIND,
  createOanixLongTextPreview,
  encodeOanixLongTextElement,
} from './oanixLongTextElementCodec.ts'
import { classifyOanixTextPaste } from './oanixLargePastePolicy.ts'
import { decodeTextBlock, encodeTextBlock } from './textBlockCodec.ts'

export interface OanixMixedLongTextInsertionPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  longTextBlockId: string
  beforeTextBlockId: string
  afterTextBlockId: string
}

interface OanixMixedLongTextPlanOptions {
  blocks: readonly EditorSurfaceBlock[]
  targetTextBlockId: string
  cursorOffset: number
  attachmentId: string
  text: string
  lines: number | null
  createId?: (kind: 'text' | 'long-text', index: number) => string
}

function defaultCreateId(kind: 'text' | 'long-text'): string {
  return `oanix-${kind}-${crypto.randomUUID()}`
}

export function planOanixMixedLongTextInsertion({
  blocks,
  targetTextBlockId,
  cursorOffset,
  attachmentId,
  text,
  lines,
  createId = defaultCreateId,
}: OanixMixedLongTextPlanOptions): OanixMixedLongTextInsertionPlan {
  if (!attachmentId) throw new Error('Long-text insertion requires an attachment id.')

  const targetIndex = blocks.findIndex((block) => block.id === targetTextBlockId)
  if (targetIndex < 0) throw new Error('Target text block was not found.')

  const target = decodeTextBlock(blocks[targetIndex])
  if (!target) throw new Error('Target block is not a supported text segment.')

  const safeCursor = Math.min(Math.max(0, cursorOffset), target.text.length)
  const beforeTextBlockId = createId('text', 0)
  const longTextBlockId = createId('long-text', 0)
  const afterTextBlockId = createId('text', 1)

  const beforeBlock = encodeTextBlock({
    id: beforeTextBlockId,
    kind: target.kind,
    text: target.text.slice(0, safeCursor),
  })
  const longTextBlock = encodeOanixLongTextElement({
    id: longTextBlockId,
    kind: OANIX_LONG_TEXT_ELEMENT_KIND,
    attachmentId,
    preview: createOanixLongTextPreview(text),
    utf16Length: text.length,
    lines,
  })
  const afterBlock = encodeTextBlock({
    id: afterTextBlockId,
    kind: target.kind,
    text: target.text.slice(safeCursor),
  })

  const nextBlocks = [
    ...blocks.slice(0, targetIndex),
    beforeBlock,
    longTextBlock,
    afterBlock,
    ...blocks.slice(targetIndex + 1),
  ]

  return {
    blocks: nextBlocks,
    upserts: [beforeBlock, longTextBlock, afterBlock],
    deletes: [targetTextBlockId],
    order: nextBlocks.map((block) => block.id),
    longTextBlockId,
    beforeTextBlockId,
    afterTextBlockId,
  }
}

export type OanixMixedLongTextInsertionResult =
  | { status: 'not-large-text' }
  | { status: 'store-failed' }
  | {
      status: 'block-save-failed'
      attachment: EditorSurfaceAttachment
      attachmentCleanupSucceeded: boolean
    }
  | {
      status: 'committed'
      attachment: EditorSurfaceAttachment
      plan: OanixMixedLongTextInsertionPlan
    }

interface InsertOanixLongTextIntoMixedDocumentOptions {
  text: string
  blocks: readonly EditorSurfaceBlock[]
  targetTextBlockId: string
  cursorOffset: number
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  createId?: (kind: 'text' | 'long-text', index: number) => string
  createFile?: (text: string) => File
}

function defaultCreateFile(text: string): File {
  return new File([text], `texto-largo-${Date.now()}.txt`, {
    type: 'text/plain;charset=utf-8',
    lastModified: Date.now(),
  })
}

/**
 * Converts a large native text paste into an attachment-backed atomic element.
 *
 * The clipboard already gives the browser one string. We avoid a second encoded
 * buffer in the document model: the File/Blob is handed to OANIX attachment storage,
 * while the rich block receives only an opaque id and a bounded preview. The target
 * uncontrolled textarea is replaced atomically only after storage succeeds.
 */
export async function insertOanixLongTextIntoMixedDocument({
  text,
  blocks,
  targetTextBlockId,
  cursorOffset,
  storeAttachment,
  saveBlockChanges,
  removeAttachment,
  createId,
  createFile = defaultCreateFile,
}: InsertOanixLongTextIntoMixedDocumentOptions): Promise<OanixMixedLongTextInsertionResult> {
  const disposition = classifyOanixTextPaste(text)
  if (disposition.mode !== 'large-text-element') return { status: 'not-large-text' }

  let file: File
  try {
    file = createFile(text)
  } catch {
    return { status: 'store-failed' }
  }

  let attachment: EditorSurfaceAttachment
  try {
    attachment = await storeAttachment(file)
  } catch {
    return { status: 'store-failed' }
  }

  let plan: OanixMixedLongTextInsertionPlan
  try {
    plan = planOanixMixedLongTextInsertion({
      blocks,
      targetTextBlockId,
      cursorOffset,
      attachmentId: attachment.id,
      text,
      lines: disposition.lines ?? null,
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
