import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceSnapshot,
} from './editorSurfaceContract.ts'
import {
  DEFAULT_OANIX_IMAGE_WIDTH_PERCENT,
  OANIX_IMAGE_ELEMENT_KIND,
  encodeOanixImageElement,
} from './oanixImageElementCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
} from './textBlockCodec.ts'

export const OANIX_IMAGE_SELECTION_LIMIT = 5
export const OANIX_IMAGE_STORE_CONCURRENCY = 2

export type OanixImageLayerProgress =
  | { stage: 'storing'; completed: number; total: number }
  | { stage: 'committing'; completed: number; total: number }

export interface OanixImageLayerPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  imageBlockIds: string[]
  afterTextBlockId: string
}

export type OanixImageLayerResult =
  | { status: 'committed'; attachments: EditorSurfaceAttachment[]; plan: OanixImageLayerPlan }
  | { status: 'invalid-selection' }
  | { status: 'store-failed'; attachmentCleanupSucceeded: boolean }
  | { status: 'document-save-failed'; attachmentCleanupSucceeded: boolean }
  | {
      status: 'plain-transition-failed'
      blockRollbackSucceeded: boolean
      attachmentCleanupSucceeded: boolean | null
    }

interface CommonOptions {
  files: readonly File[]
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  onProgress?: (progress: OanixImageLayerProgress) => void
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

type OanixImageLayerOptions = PlainOptions | MixedOptions

function chunkText(text: string): string[] {
  if (text.length === 0) return ['']
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; offset += MAX_TEXT_BLOCK_TEXT_LENGTH) {
    chunks.push(text.slice(offset, offset + MAX_TEXT_BLOCK_TEXT_LENGTH))
  }
  return chunks
}

function createIdFactory(createId?: (kind: 'text' | 'image', index: number) => string) {
  const counters = { text: 0, image: 0 }
  return (kind: 'text' | 'image') => {
    const index = counters[kind]++
    return createId?.(kind, index) ?? `oanix-${kind}-${crypto.randomUUID()}`
  }
}

function makeTextBlock(id: string, text: string): EditorSurfaceBlock {
  return encodeTextBlock({ id, kind: TEXT_BLOCK_KIND, text })
}

function makeImageBlock(id: string, attachmentId: string): EditorSurfaceBlock {
  return encodeOanixImageElement({
    id,
    kind: OANIX_IMAGE_ELEMENT_KIND,
    attachmentId,
    widthPercent: DEFAULT_OANIX_IMAGE_WIDTH_PERCENT,
    sizeLocked: false,
  })
}

function buildImageSequence(
  attachmentIds: readonly string[],
  nextId: ReturnType<typeof createIdFactory>,
): { blocks: EditorSurfaceBlock[]; imageBlockIds: string[] } {
  const blocks: EditorSurfaceBlock[] = []
  const imageBlockIds: string[] = []

  attachmentIds.forEach((attachmentId, index) => {
    const imageId = nextId('image')
    imageBlockIds.push(imageId)
    blocks.push(makeImageBlock(imageId, attachmentId))
    if (index < attachmentIds.length - 1) blocks.push(makeTextBlock(nextId('text'), ''))
  })

  return { blocks, imageBlockIds }
}

function buildPlainPlan(
  text: string,
  cursorOffset: number,
  attachmentIds: readonly string[],
  createId?: (kind: 'text' | 'image', index: number) => string,
): OanixImageLayerPlan {
  const safeCursor = Math.min(Math.max(0, cursorOffset), text.length)
  const beforeText = text.slice(0, safeCursor)
  const afterText = text.slice(safeCursor)
  const nextId = createIdFactory(createId)
  const beforeBlocks = chunkText(beforeText).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const imageSequence = buildImageSequence(attachmentIds, nextId)
  const afterBlocks = chunkText(afterText).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const blocks = [...beforeBlocks, ...imageSequence.blocks, ...afterBlocks]
  const afterTextBlockId = afterBlocks[0]?.id
  if (!afterTextBlockId) throw new Error('Image layer requires a trailing text block.')

  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    imageBlockIds: imageSequence.imageBlockIds,
    afterTextBlockId,
  }
}

function buildMixedPlan(
  originalBlocks: readonly EditorSurfaceBlock[],
  targetTextBlockId: string,
  cursorOffset: number,
  attachmentIds: readonly string[],
  createId?: (kind: 'text' | 'image', index: number) => string,
): OanixImageLayerPlan {
  const targetIndex = originalBlocks.findIndex((block) => block.id === targetTextBlockId)
  if (targetIndex < 0) throw new Error('Image target text block was not found.')
  const target = decodeTextBlock(originalBlocks[targetIndex])
  if (!target) throw new Error('Image target is not editable text.')

  const safeCursor = Math.min(Math.max(0, cursorOffset), target.text.length)
  const nextId = createIdFactory(createId)
  const beforeBlock = makeTextBlock(nextId('text'), target.text.slice(0, safeCursor))
  const imageSequence = buildImageSequence(attachmentIds, nextId)
  const afterBlock = makeTextBlock(nextId('text'), target.text.slice(safeCursor))
  const replacement = [beforeBlock, ...imageSequence.blocks, afterBlock]
  const blocks = [
    ...originalBlocks.slice(0, targetIndex),
    ...replacement,
    ...originalBlocks.slice(targetIndex + 1),
  ]

  return {
    blocks,
    upserts: replacement,
    deletes: [targetTextBlockId],
    order: blocks.map((block) => block.id),
    imageBlockIds: imageSequence.imageBlockIds,
    afterTextBlockId: afterBlock.id,
  }
}

async function cleanupAttachments(
  attachments: readonly EditorSurfaceAttachment[],
  removeAttachment: (attachmentId: string) => Promise<boolean>,
): Promise<boolean> {
  const outcomes = await Promise.all(attachments.map(async (attachment) => {
    try {
      return await removeAttachment(attachment.id)
    } catch {
      return false
    }
  }))
  return outcomes.every(Boolean)
}

async function storeSelection(
  files: readonly File[],
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>,
  onProgress?: (progress: OanixImageLayerProgress) => void,
): Promise<{ attachments: EditorSurfaceAttachment[]; failed: boolean }> {
  const results: Array<EditorSurfaceAttachment | null> = Array.from({ length: files.length }, () => null)
  let nextIndex = 0
  let completed = 0
  let failed = false

  onProgress?.({ stage: 'storing', completed: 0, total: files.length })

  async function worker() {
    while (!failed) {
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

  await Promise.all(
    Array.from({ length: Math.min(OANIX_IMAGE_STORE_CONCURRENCY, files.length) }, () => worker()),
  )

  return {
    attachments: results.filter((item): item is EditorSurfaceAttachment => Boolean(item)),
    failed,
  }
}

export async function insertOanixImages(options: OanixImageLayerOptions): Promise<OanixImageLayerResult> {
  const { files, storeAttachment, saveBlockChanges, removeAttachment, onProgress, createId } = options
  if (files.length < 1 || files.length > OANIX_IMAGE_SELECTION_LIMIT) return { status: 'invalid-selection' }
  if (options.mode === 'plain' && options.existingBlocks.length > 0) return { status: 'invalid-selection' }

  const stored = await storeSelection(files, storeAttachment, onProgress)
  if (stored.failed || stored.attachments.length !== files.length) {
    return {
      status: 'store-failed',
      attachmentCleanupSucceeded: await cleanupAttachments(stored.attachments, removeAttachment),
    }
  }

  let plan: OanixImageLayerPlan
  try {
    const attachmentIds = stored.attachments.map((attachment) => attachment.id)
    plan = options.mode === 'plain'
      ? buildPlainPlan(options.text, options.cursorOffset, attachmentIds, createId)
      : buildMixedPlan(options.blocks, options.targetTextBlockId, options.cursorOffset, attachmentIds, createId)
  } catch {
    return {
      status: 'document-save-failed',
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
      status: 'document-save-failed',
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
    status: 'plain-transition-failed',
    blockRollbackSucceeded,
    attachmentCleanupSucceeded: blockRollbackSucceeded
      ? await cleanupAttachments(stored.attachments, removeAttachment)
      : null,
  }
}
