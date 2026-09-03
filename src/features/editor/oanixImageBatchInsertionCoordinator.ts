import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceSnapshot,
} from './editorSurfaceContract.ts'
import { planOanixMixedDocumentImageInsertion } from './oanixMixedDocumentPlan.ts'
import { planOanixMixedImageInsertion } from './oanixMixedImageInsertion.ts'

export const OANIX_IMAGE_BATCH_LIMIT = 5
export const OANIX_IMAGE_BATCH_CONCURRENCY = 2

export type OanixImageBatchProgress =
  | { stage: 'storing'; completed: number; total: number }
  | { stage: 'committing'; completed: number; total: number }

export interface OanixImageBatchPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  imageBlockIds: string[]
  afterTextBlockId: string
}

export type OanixImageBatchInsertionResult =
  | { status: 'committed'; attachments: EditorSurfaceAttachment[]; plan: OanixImageBatchPlan }
  | { status: 'invalid-batch' }
  | { status: 'store-failed'; attachmentCleanupSucceeded: boolean }
  | { status: 'block-save-failed'; attachmentCleanupSucceeded: boolean }
  | {
      status: 'plain-save-failed'
      blockRollbackSucceeded: boolean
      attachmentCleanupSucceeded: boolean | null
    }

interface CommonOptions {
  files: readonly File[]
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  onProgress?: (progress: OanixImageBatchProgress) => void
  createId?: (kind: 'text' | 'image', index: number) => string
}

interface PlainOptions extends CommonOptions {
  mode: 'plain'
  title: string
  text: string
  cursorOffset: number
  existingBlocks: readonly EditorSurfaceBlock[]
  savePlainSnapshot: (snapshot: EditorSurfaceSnapshot) => Promise<boolean>
}

interface MixedOptions extends CommonOptions {
  mode: 'mixed'
  blocks: readonly EditorSurfaceBlock[]
  targetTextBlockId: string
  cursorOffset: number
}

type Options = PlainOptions | MixedOptions

async function cleanupAttachments(
  attachments: readonly EditorSurfaceAttachment[],
  removeAttachment: (attachmentId: string) => Promise<boolean>,
): Promise<boolean> {
  let succeeded = true
  for (const attachment of attachments) {
    try {
      if (!(await removeAttachment(attachment.id))) succeeded = false
    } catch {
      succeeded = false
    }
  }
  return succeeded
}

async function storeBatch(
  files: readonly File[],
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>,
  onProgress?: (progress: OanixImageBatchProgress) => void,
): Promise<{ attachments: EditorSurfaceAttachment[]; failed: boolean }> {
  const results: Array<EditorSurfaceAttachment | null> = Array.from({ length: files.length }, () => null)
  let nextIndex = 0
  let completed = 0
  let failed = false

  onProgress?.({ stage: 'storing', completed: 0, total: files.length })

  async function worker() {
    while (true) {
      const index = nextIndex++
      if (index >= files.length) return
      try {
        results[index] = await storeAttachment(files[index])
      } catch {
        failed = true
      } finally {
        completed += 1
        onProgress?.({ stage: 'storing', completed, total: files.length })
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(OANIX_IMAGE_BATCH_CONCURRENCY, files.length) },
    () => worker(),
  )
  await Promise.all(workers)

  return {
    attachments: results.filter((item): item is EditorSurfaceAttachment => Boolean(item)),
    failed,
  }
}

function createBatchIdFactory(createId?: (kind: 'text' | 'image', index: number) => string) {
  const counters = { text: 0, image: 0 }
  return (kind: 'text' | 'image') => {
    const index = counters[kind]++
    return createId?.(kind, index) ?? `oanix-${kind}-${crypto.randomUUID()}`
  }
}

function buildPlainPlan(
  text: string,
  cursorOffset: number,
  attachmentIds: readonly string[],
  createId?: (kind: 'text' | 'image', index: number) => string,
): OanixImageBatchPlan {
  const nextId = createBatchIdFactory(createId)
  const first = planOanixMixedDocumentImageInsertion({
    text,
    cursorOffset,
    attachmentId: attachmentIds[0],
    createId: (kind) => nextId(kind),
  })

  let blocks = first.blocks
  const firstImageIndex = blocks.findIndex((block) => block.id === first.imageBlockId)
  const firstAfterBlock = blocks[firstImageIndex + 1]
  if (!firstAfterBlock) throw new Error('Image batch requires a trailing text block.')
  let afterTextBlockId = firstAfterBlock.id
  const imageBlockIds = [first.imageBlockId]

  for (const attachmentId of attachmentIds.slice(1)) {
    const next = planOanixMixedImageInsertion({
      blocks,
      targetTextBlockId: afterTextBlockId,
      cursorOffset: 0,
      attachmentId,
      createId: (kind) => nextId(kind),
    })
    blocks = next.blocks
    imageBlockIds.push(next.imageBlockId)
    afterTextBlockId = next.afterTextBlockId
  }

  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    imageBlockIds,
    afterTextBlockId,
  }
}

function buildMixedPlan(
  originalBlocks: readonly EditorSurfaceBlock[],
  targetTextBlockId: string,
  cursorOffset: number,
  attachmentIds: readonly string[],
  createId?: (kind: 'text' | 'image', index: number) => string,
): OanixImageBatchPlan {
  const nextId = createBatchIdFactory(createId)
  const originalIds = new Set(originalBlocks.map((block) => block.id))
  const first = planOanixMixedImageInsertion({
    blocks: originalBlocks,
    targetTextBlockId,
    cursorOffset,
    attachmentId: attachmentIds[0],
    createId: (kind) => nextId(kind),
  })

  let blocks = first.blocks
  let afterTextBlockId = first.afterTextBlockId
  const imageBlockIds = [first.imageBlockId]

  for (const attachmentId of attachmentIds.slice(1)) {
    const next = planOanixMixedImageInsertion({
      blocks,
      targetTextBlockId: afterTextBlockId,
      cursorOffset: 0,
      attachmentId,
      createId: (kind) => nextId(kind),
    })
    blocks = next.blocks
    imageBlockIds.push(next.imageBlockId)
    afterTextBlockId = next.afterTextBlockId
  }

  return {
    blocks,
    upserts: blocks.filter((block) => !originalIds.has(block.id)),
    deletes: [targetTextBlockId],
    order: blocks.map((block) => block.id),
    imageBlockIds,
    afterTextBlockId,
  }
}

export async function insertOanixImageBatch(options: Options): Promise<OanixImageBatchInsertionResult> {
  const { files, storeAttachment, saveBlockChanges, removeAttachment, onProgress, createId } = options
  if (files.length < 1 || files.length > OANIX_IMAGE_BATCH_LIMIT) return { status: 'invalid-batch' }
  if (options.mode === 'plain' && options.existingBlocks.length > 0) return { status: 'invalid-batch' }

  const stored = await storeBatch(files, storeAttachment, onProgress)
  if (stored.failed || stored.attachments.length !== files.length) {
    return {
      status: 'store-failed',
      attachmentCleanupSucceeded: await cleanupAttachments(stored.attachments, removeAttachment),
    }
  }

  let plan: OanixImageBatchPlan
  try {
    const attachmentIds = stored.attachments.map((attachment) => attachment.id)
    plan = options.mode === 'plain'
      ? buildPlainPlan(options.text, options.cursorOffset, attachmentIds, createId)
      : buildMixedPlan(options.blocks, options.targetTextBlockId, options.cursorOffset, attachmentIds, createId)
  } catch {
    return {
      status: 'block-save-failed',
      attachmentCleanupSucceeded: await cleanupAttachments(stored.attachments, removeAttachment),
    }
  }

  onProgress?.({ stage: 'committing', completed: files.length, total: files.length })
  let blocksSaved = false
  try {
    blocksSaved = await saveBlockChanges({
      upserts: plan.upserts,
      deletes: plan.deletes.length > 0 ? plan.deletes : undefined,
      order: plan.order,
    })
  } catch {
    blocksSaved = false
  }

  if (!blocksSaved) {
    return {
      status: 'block-save-failed',
      attachmentCleanupSucceeded: await cleanupAttachments(stored.attachments, removeAttachment),
    }
  }

  if (options.mode === 'mixed') {
    return { status: 'committed', attachments: stored.attachments, plan }
  }

  let plainSaved = false
  try {
    plainSaved = await options.savePlainSnapshot({ title: options.title, text: '' })
  } catch {
    plainSaved = false
  }
  if (plainSaved) return { status: 'committed', attachments: stored.attachments, plan }

  let blockRollbackSucceeded = false
  try {
    blockRollbackSucceeded = await saveBlockChanges({ deletes: plan.order, order: [] })
  } catch {
    blockRollbackSucceeded = false
  }

  return {
    status: 'plain-save-failed',
    blockRollbackSucceeded,
    attachmentCleanupSucceeded: blockRollbackSucceeded
      ? await cleanupAttachments(stored.attachments, removeAttachment)
      : null,
  }
}
