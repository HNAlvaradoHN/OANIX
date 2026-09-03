import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceSnapshot,
} from './editorSurfaceContract.ts'
import { planOanixCursorInsertion } from './oanixDocumentInsertion.ts'
import { classifyOanixTextPaste } from './oanixLargePastePolicy.ts'
import {
  OANIX_LONG_TEXT_ELEMENT_KIND,
  createOanixLongTextPreview,
  encodeOanixLongTextElement,
} from './oanixLongTextElementCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  encodeTextBlock,
} from './textBlockCodec.ts'

export interface OanixPlainLongTextInsertionPlan {
  blocks: EditorSurfaceBlock[]
  order: string[]
  longTextBlockId: string
  afterTextBlockId: string
}

interface OanixPlainLongTextPlanOptions {
  sourceText: string
  cursorOffset: number
  pastedText: string
  attachmentId: string
  lines: number | null
  createId?: (kind: 'text' | 'long-text', index: number) => string
}

function defaultCreateId(kind: 'text' | 'long-text'): string {
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

export function planOanixPlainLongTextInsertion({
  sourceText,
  cursorOffset,
  pastedText,
  attachmentId,
  lines,
  createId = defaultCreateId,
}: OanixPlainLongTextPlanOptions): OanixPlainLongTextInsertionPlan {
  if (!attachmentId) throw new Error('Long-text insertion requires an attachment id.')

  const split = planOanixCursorInsertion(sourceText, cursorOffset)
  let textIndex = 0
  const beforeBlocks = chunkText(split.beforeText).map((text) => encodeTextBlock({
    id: createId('text', textIndex++),
    kind: TEXT_BLOCK_KIND,
    text,
  }))
  const longTextBlockId = createId('long-text', 0)
  const longTextBlock = encodeOanixLongTextElement({
    id: longTextBlockId,
    kind: OANIX_LONG_TEXT_ELEMENT_KIND,
    attachmentId,
    preview: createOanixLongTextPreview(pastedText),
    utf16Length: pastedText.length,
    lines,
  })
  const afterBlocks = chunkText(split.afterText).map((text) => encodeTextBlock({
    id: createId('text', textIndex++),
    kind: TEXT_BLOCK_KIND,
    text,
  }))
  const blocks = [...beforeBlocks, longTextBlock, ...afterBlocks]

  return {
    blocks,
    order: blocks.map((block) => block.id),
    longTextBlockId,
    afterTextBlockId: afterBlocks[0].id,
  }
}

export type OanixPlainLongTextInsertionResult =
  | { status: 'not-large-text' }
  | { status: 'store-failed' }
  | { status: 'blocked-existing-blocks'; attachment: EditorSurfaceAttachment; attachmentCleanupSucceeded: boolean }
  | { status: 'block-save-failed'; attachment: EditorSurfaceAttachment; attachmentCleanupSucceeded: boolean }
  | {
      status: 'plain-save-failed'
      attachment: EditorSurfaceAttachment
      blockRollbackSucceeded: boolean
      attachmentCleanupSucceeded: boolean | null
    }
  | { status: 'committed'; attachment: EditorSurfaceAttachment; plan: OanixPlainLongTextInsertionPlan }

interface InsertOanixLongTextIntoPlainDocumentOptions {
  pastedText: string
  title: string
  sourceText: string
  cursorOffset: number
  existingBlocks: readonly EditorSurfaceBlock[]
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  savePlainSnapshot: (snapshot: EditorSurfaceSnapshot) => Promise<boolean>
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

async function tryRemoveAttachment(
  removeAttachment: (attachmentId: string) => Promise<boolean>,
  attachmentId: string,
): Promise<boolean> {
  try {
    return await removeAttachment(attachmentId)
  } catch {
    return false
  }
}

/**
 * Converts the first oversized native text paste in a still-plain note into an
 * attachment-backed atomic element without exposing a half-migrated document.
 *
 * The original plain text remains authoritative until the complete mixed block set
 * is durable. Only then is the plain body cleared. If that final clear fails, the
 * staged blocks are rolled back before the attachment is removed. When block rollback
 * cannot be confirmed the attachment is deliberately retained because references may
 * still exist; recoverable duplication is safer than silent loss.
 */
export async function insertOanixLongTextIntoPlainDocument({
  pastedText,
  title,
  sourceText,
  cursorOffset,
  existingBlocks,
  storeAttachment,
  saveBlockChanges,
  savePlainSnapshot,
  removeAttachment,
  createId,
  createFile = defaultCreateFile,
}: InsertOanixLongTextIntoPlainDocumentOptions): Promise<OanixPlainLongTextInsertionResult> {
  const disposition = classifyOanixTextPaste(pastedText)
  if (disposition.mode !== 'large-text-element') return { status: 'not-large-text' }

  let file: File
  try {
    file = createFile(pastedText)
  } catch {
    return { status: 'store-failed' }
  }

  let attachment: EditorSurfaceAttachment
  try {
    attachment = await storeAttachment(file)
  } catch {
    return { status: 'store-failed' }
  }

  if (existingBlocks.length > 0) {
    return {
      status: 'blocked-existing-blocks',
      attachment,
      attachmentCleanupSucceeded: await tryRemoveAttachment(removeAttachment, attachment.id),
    }
  }

  const plan = planOanixPlainLongTextInsertion({
    sourceText,
    cursorOffset,
    pastedText,
    attachmentId: attachment.id,
    lines: disposition.lines ?? null,
    createId,
  })

  let blocksSaved = false
  try {
    blocksSaved = await saveBlockChanges({ upserts: plan.blocks, order: plan.order })
  } catch {
    blocksSaved = false
  }

  if (!blocksSaved) {
    return {
      status: 'block-save-failed',
      attachment,
      attachmentCleanupSucceeded: await tryRemoveAttachment(removeAttachment, attachment.id),
    }
  }

  let plainSaved = false
  try {
    plainSaved = await savePlainSnapshot({ title, text: '' })
  } catch {
    plainSaved = false
  }

  if (plainSaved) return { status: 'committed', attachment, plan }

  let blockRollbackSucceeded = false
  try {
    blockRollbackSucceeded = await saveBlockChanges({ deletes: plan.order, order: [] })
  } catch {
    blockRollbackSucceeded = false
  }

  const attachmentCleanupSucceeded = blockRollbackSucceeded
    ? await tryRemoveAttachment(removeAttachment, attachment.id)
    : null

  return {
    status: 'plain-save-failed',
    attachment,
    blockRollbackSucceeded,
    attachmentCleanupSucceeded,
  }
}
