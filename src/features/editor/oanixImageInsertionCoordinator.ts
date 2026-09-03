import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceSnapshot,
} from './editorSurfaceContract.ts'
import {
  commitOanixMixedDocumentImageTransition,
  type OanixMixedDocumentTransitionResult,
} from './oanixMixedDocumentTransition.ts'

export type OanixImageInsertionResult =
  | { status: 'store-failed' }
  | { status: 'committed'; attachment: EditorSurfaceAttachment; transition: Extract<OanixMixedDocumentTransitionResult, { status: 'committed' }> }
  | { status: 'transition-failed'; attachment: EditorSurfaceAttachment; transition: Exclude<OanixMixedDocumentTransitionResult, { status: 'committed' }> }

interface OanixImageInsertionOptions {
  file: File
  title: string
  text: string
  cursorOffset: number
  existingBlocks: readonly EditorSurfaceBlock[]
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  savePlainSnapshot: (snapshot: EditorSurfaceSnapshot) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  createId?: (kind: 'text' | 'image', index: number) => string
}

/**
 * Single application-level command for both file-picker and native paste images.
 *
 * UI code supplies the File and native textarea cursor. The command stores the
 * encrypted asset through OANIX first, then delegates the recoverable document
 * transition. Storage details never enter the visual sheet and both picker/paste
 * paths therefore share identical rollback behavior.
 */
export async function insertOanixImageAtCursor({
  file,
  title,
  text,
  cursorOffset,
  existingBlocks,
  storeAttachment,
  saveBlockChanges,
  savePlainSnapshot,
  removeAttachment,
  createId,
}: OanixImageInsertionOptions): Promise<OanixImageInsertionResult> {
  let attachment: EditorSurfaceAttachment
  try {
    attachment = await storeAttachment(file)
  } catch {
    return { status: 'store-failed' }
  }

  const transition = await commitOanixMixedDocumentImageTransition({
    title,
    text,
    cursorOffset,
    attachmentId: attachment.id,
    existingBlocks,
    saveBlockChanges,
    savePlainSnapshot,
    removeAttachment,
    createId,
  })

  if (transition.status === 'committed') {
    return { status: 'committed', attachment, transition }
  }

  return { status: 'transition-failed', attachment, transition }
}
