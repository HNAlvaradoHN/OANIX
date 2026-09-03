import type {
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceSnapshot,
} from './editorSurfaceContract.ts'
import {
  planOanixMixedDocumentImageInsertion,
  type OanixMixedDocumentPlan,
} from './oanixMixedDocumentPlan.ts'

export type OanixMixedDocumentTransitionResult =
  | { status: 'committed'; plan: OanixMixedDocumentPlan }
  | { status: 'blocked-existing-blocks'; attachmentCleanupSucceeded: boolean }
  | { status: 'block-save-failed'; attachmentCleanupSucceeded: boolean }
  | {
      status: 'plain-save-failed'
      blockRollbackSucceeded: boolean
      attachmentCleanupSucceeded: boolean | null
    }

interface OanixMixedDocumentTransitionOptions {
  title: string
  text: string
  cursorOffset: number
  attachmentId: string
  existingBlocks: readonly EditorSurfaceBlock[]
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  savePlainSnapshot: (snapshot: EditorSurfaceSnapshot) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  createId?: (kind: 'text' | 'image', index: number) => string
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
 * Converts one still-plain note to a mixed block document using compensation rather
 * than pretending the plain snapshot and block store share one database transaction.
 *
 * Safety order:
 * 1. the caller has already stored the encrypted asset;
 * 2. persist the complete mixed block set while the original plain text still exists;
 * 3. only after blocks succeed, clear the plain body snapshot;
 * 4. if clearing plain text fails, remove the staged blocks and then the new asset.
 *
 * If block rollback itself fails we deliberately keep the attachment, because block
 * references may still exist. That can leave duplicate recoverable content, but does
 * not turn a transient failure into silent data loss.
 *
 * Existing rich blocks currently block the transition. Mixing a legacy/plain body
 * with pre-existing hidden blocks needs an explicit merge policy before activation.
 */
export async function commitOanixMixedDocumentImageTransition({
  title,
  text,
  cursorOffset,
  attachmentId,
  existingBlocks,
  saveBlockChanges,
  savePlainSnapshot,
  removeAttachment,
  createId,
}: OanixMixedDocumentTransitionOptions): Promise<OanixMixedDocumentTransitionResult> {
  if (existingBlocks.length > 0) {
    return {
      status: 'blocked-existing-blocks',
      attachmentCleanupSucceeded: await tryRemoveAttachment(removeAttachment, attachmentId),
    }
  }

  const plan = planOanixMixedDocumentImageInsertion({
    text,
    cursorOffset,
    attachmentId,
    createId,
  })

  let blocksSaved = false
  try {
    blocksSaved = await saveBlockChanges({
      upserts: plan.blocks,
      order: plan.order,
    })
  } catch {
    blocksSaved = false
  }

  if (!blocksSaved) {
    return {
      status: 'block-save-failed',
      attachmentCleanupSucceeded: await tryRemoveAttachment(removeAttachment, attachmentId),
    }
  }

  let plainSaved = false
  try {
    plainSaved = await savePlainSnapshot({ title, text: '' })
  } catch {
    plainSaved = false
  }

  if (plainSaved) return { status: 'committed', plan }

  let blockRollbackSucceeded = false
  try {
    blockRollbackSucceeded = await saveBlockChanges({
      deletes: plan.order,
      order: [],
    })
  } catch {
    blockRollbackSucceeded = false
  }

  const attachmentCleanupSucceeded = blockRollbackSucceeded
    ? await tryRemoveAttachment(removeAttachment, attachmentId)
    : null

  return {
    status: 'plain-save-failed',
    blockRollbackSucceeded,
    attachmentCleanupSucceeded,
  }
}
