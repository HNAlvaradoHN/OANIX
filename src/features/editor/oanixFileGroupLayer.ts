import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceSnapshot,
} from './editorSurfaceContract.ts'
import {
  MAX_OANIX_FILE_GROUP_ITEMS,
  OANIX_FILE_GROUP_ELEMENT_KIND,
  decodeOanixFileGroupElement,
  encodeOanixFileGroupElement,
} from './oanixFileGroupElementCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
} from './textBlockCodec.ts'

export const OANIX_FILE_GROUP_STORE_CONCURRENCY = 2

export type OanixFileGroupProgress =
  | { stage: 'storing'; completed: number; total: number }
  | { stage: 'committing'; completed: number; total: number }

export interface OanixFileGroupPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  groupBlockId: string
  afterTextBlockId: string
}

export type OanixFileGroupInsertionResult =
  | { status: 'committed'; attachments: EditorSurfaceAttachment[]; plan: OanixFileGroupPlan }
  | { status: 'invalid-selection' }
  | { status: 'store-failed'; attachmentCleanupSucceeded: boolean }
  | { status: 'document-save-failed'; attachmentCleanupSucceeded: boolean }
  | {
      status: 'plain-transition-failed'
      blockRollbackSucceeded: boolean
      attachmentCleanupSucceeded: boolean | null
    }

export type OanixFileGroupAppendResult =
  | { status: 'committed'; attachments: EditorSurfaceAttachment[]; block: EditorSurfaceBlock }
  | { status: 'invalid-selection' | 'invalid-group' }
  | { status: 'store-failed' | 'document-save-failed'; attachmentCleanupSucceeded: boolean }

interface CommonInsertOptions {
  files: readonly File[]
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  onProgress?: (progress: OanixFileGroupProgress) => void
  createId?: (kind: 'text' | 'file-group', index: number) => string
}

interface PlainInsertOptions extends CommonInsertOptions {
  mode: 'plain'
  title: string
  text: string
  cursorOffset: number
  existingBlocks: readonly EditorSurfaceBlock[]
  savePlainSnapshot: (snapshot: EditorSurfaceSnapshot) => Promise<boolean>
}

interface MixedInsertOptions extends CommonInsertOptions {
  mode: 'mixed'
  blocks: readonly EditorSurfaceBlock[]
  targetTextBlockId: string
  cursorOffset: number
}

type InsertOptions = PlainInsertOptions | MixedInsertOptions

interface AppendOptions {
  groupBlock: EditorSurfaceBlock
  files: readonly File[]
  storeAttachment: (file: File) => Promise<EditorSurfaceAttachment>
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  onProgress?: (progress: OanixFileGroupProgress) => void
}

function chunkText(text: string): string[] {
  if (text.length === 0) return ['']
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; offset += MAX_TEXT_BLOCK_TEXT_LENGTH) {
    chunks.push(text.slice(offset, offset + MAX_TEXT_BLOCK_TEXT_LENGTH))
  }
  return chunks
}

function createIdFactory(createId?: (kind: 'text' | 'file-group', index: number) => string) {
  const counters = { text: 0, 'file-group': 0 }
  return (kind: 'text' | 'file-group') => {
    const index = counters[kind]++
    return createId?.(kind, index) ?? `oanix-${kind}-${crypto.randomUUID()}`
  }
}

function makeTextBlock(id: string, text: string): EditorSurfaceBlock {
  return encodeTextBlock({ id, kind: TEXT_BLOCK_KIND, text })
}

function makeGroupBlock(id: string, attachmentIds: readonly string[]): EditorSurfaceBlock {
  return encodeOanixFileGroupElement({
    id,
    kind: OANIX_FILE_GROUP_ELEMENT_KIND,
    attachmentIds: [...attachmentIds],
  })
}

function buildPlainPlan(
  text: string,
  cursorOffset: number,
  attachmentIds: readonly string[],
  createId?: (kind: 'text' | 'file-group', index: number) => string,
): OanixFileGroupPlan {
  const safeCursor = Math.min(Math.max(0, cursorOffset), text.length)
  const nextId = createIdFactory(createId)
  const beforeBlocks = chunkText(text.slice(0, safeCursor)).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const groupBlock = makeGroupBlock(nextId('file-group'), attachmentIds)
  const afterBlocks = chunkText(text.slice(safeCursor)).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const blocks = [...beforeBlocks, groupBlock, ...afterBlocks]
  const afterTextBlockId = afterBlocks[0]?.id
  if (!afterTextBlockId) throw new Error('File group requires a trailing text block.')

  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    groupBlockId: groupBlock.id,
    afterTextBlockId,
  }
}

function buildMixedPlan(
  originalBlocks: readonly EditorSurfaceBlock[],
  targetTextBlockId: string,
  cursorOffset: number,
  attachmentIds: readonly string[],
  createId?: (kind: 'text' | 'file-group', index: number) => string,
): OanixFileGroupPlan {
  const targetIndex = originalBlocks.findIndex((block) => block.id === targetTextBlockId)
  if (targetIndex < 0) throw new Error('File group target text block was not found.')
  const target = decodeTextBlock(originalBlocks[targetIndex])
  if (!target) throw new Error('File group target is not editable text.')

  const safeCursor = Math.min(Math.max(0, cursorOffset), target.text.length)
  const nextId = createIdFactory(createId)
  const beforeBlock = makeTextBlock(nextId('text'), target.text.slice(0, safeCursor))
  const groupBlock = makeGroupBlock(nextId('file-group'), attachmentIds)
  const afterBlock = makeTextBlock(nextId('text'), target.text.slice(safeCursor))
  const replacement = [beforeBlock, groupBlock, afterBlock]
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
    groupBlockId: groupBlock.id,
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
  onProgress?: (progress: OanixFileGroupProgress) => void,
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
    Array.from({ length: Math.min(OANIX_FILE_GROUP_STORE_CONCURRENCY, files.length) }, () => worker()),
  )

  return {
    attachments: results.filter((item): item is EditorSurfaceAttachment => Boolean(item)),
    failed,
  }
}

export async function insertOanixFileGroup(options: InsertOptions): Promise<OanixFileGroupInsertionResult> {
  const { files, storeAttachment, saveBlockChanges, removeAttachment, onProgress, createId } = options
  if (files.length < 1 || files.length > MAX_OANIX_FILE_GROUP_ITEMS) return { status: 'invalid-selection' }
  if (options.mode === 'plain' && options.existingBlocks.length > 0) return { status: 'invalid-selection' }

  const stored = await storeSelection(files, storeAttachment, onProgress)
  if (stored.failed || stored.attachments.length !== files.length) {
    return {
      status: 'store-failed',
      attachmentCleanupSucceeded: await cleanupAttachments(stored.attachments, removeAttachment),
    }
  }

  let plan: OanixFileGroupPlan
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

export async function appendOanixFileGroupFiles(options: AppendOptions): Promise<OanixFileGroupAppendResult> {
  const group = decodeOanixFileGroupElement(options.groupBlock)
  if (!group) return { status: 'invalid-group' }
  if (
    options.files.length < 1
    || group.attachmentIds.length + options.files.length > MAX_OANIX_FILE_GROUP_ITEMS
  ) return { status: 'invalid-selection' }

  const stored = await storeSelection(options.files, options.storeAttachment, options.onProgress)
  if (stored.failed || stored.attachments.length !== options.files.length) {
    return {
      status: 'store-failed',
      attachmentCleanupSucceeded: await cleanupAttachments(stored.attachments, options.removeAttachment),
    }
  }

  const nextBlock = encodeOanixFileGroupElement({
    ...group,
    attachmentIds: [...group.attachmentIds, ...stored.attachments.map((attachment) => attachment.id)],
  })
  options.onProgress?.({ stage: 'committing', completed: options.files.length, total: options.files.length })

  let saved = false
  try {
    saved = await options.saveBlockChanges({ upserts: [nextBlock] })
  } catch {
    saved = false
  }
  if (!saved) {
    return {
      status: 'document-save-failed',
      attachmentCleanupSucceeded: await cleanupAttachments(stored.attachments, options.removeAttachment),
    }
  }

  return { status: 'committed', attachments: stored.attachments, block: nextBlock }
}
