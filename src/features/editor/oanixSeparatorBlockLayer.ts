import type { EditorSurfaceBlock, EditorSurfaceBlockChangeSet, EditorSurfaceSnapshot } from './editorSurfaceContract.ts'
import { SEPARATOR_BLOCK_KIND, encodeSeparatorBlock } from './separatorBlockCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
} from './textBlockCodec.ts'

export interface OanixSeparatorBlockPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  separatorBlockId: string
  afterTextBlockId: string
}

export type OanixSeparatorBlockInsertionResult =
  | { status: 'committed'; plan: OanixSeparatorBlockPlan }
  | { status: 'invalid-target' | 'document-save-failed' }
  | { status: 'plain-transition-failed'; blockRollbackSucceeded: boolean }

interface CommonOptions {
  cursorOffset: number
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  createId?: (kind: 'text' | 'separator', index: number) => string
}

interface PlainOptions extends CommonOptions {
  mode: 'plain'
  title: string
  text: string
  existingBlocks: readonly EditorSurfaceBlock[]
  savePlainSnapshot: (snapshot: EditorSurfaceSnapshot) => Promise<boolean>
}

interface MixedOptions extends CommonOptions {
  mode: 'mixed'
  blocks: readonly EditorSurfaceBlock[]
  targetTextBlockId: string
}

type InsertOptions = PlainOptions | MixedOptions

function chunkText(text: string): string[] {
  if (text.length === 0) return ['']
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; offset += MAX_TEXT_BLOCK_TEXT_LENGTH) {
    chunks.push(text.slice(offset, offset + MAX_TEXT_BLOCK_TEXT_LENGTH))
  }
  return chunks
}

function createIdFactory(createId?: CommonOptions['createId']) {
  const counters = { text: 0, separator: 0 }
  return (kind: 'text' | 'separator') => {
    const index = counters[kind]++
    return createId?.(kind, index) ?? `oanix-${kind}-${crypto.randomUUID()}`
  }
}

function makeTextBlock(id: string, text: string): EditorSurfaceBlock {
  return encodeTextBlock({ id, kind: TEXT_BLOCK_KIND, text })
}

function makeSeparatorBlock(id: string): EditorSurfaceBlock {
  return encodeSeparatorBlock({ id, kind: SEPARATOR_BLOCK_KIND })
}

function buildPlainPlan(
  text: string,
  cursorOffset: number,
  createId?: CommonOptions['createId'],
): OanixSeparatorBlockPlan {
  const safeCursor = Math.min(Math.max(0, cursorOffset), text.length)
  const nextId = createIdFactory(createId)
  const beforeBlocks = chunkText(text.slice(0, safeCursor)).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const separatorBlock = makeSeparatorBlock(nextId('separator'))
  const afterBlocks = chunkText(text.slice(safeCursor)).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const blocks = [...beforeBlocks, separatorBlock, ...afterBlocks]
  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    separatorBlockId: separatorBlock.id,
    afterTextBlockId: afterBlocks[0].id,
  }
}

function buildMixedPlan(
  originalBlocks: readonly EditorSurfaceBlock[],
  targetTextBlockId: string,
  cursorOffset: number,
  createId?: CommonOptions['createId'],
): OanixSeparatorBlockPlan | null {
  const targetIndex = originalBlocks.findIndex((block) => block.id === targetTextBlockId)
  if (targetIndex < 0) return null
  const target = decodeTextBlock(originalBlocks[targetIndex])
  if (!target) return null

  const safeCursor = Math.min(Math.max(0, cursorOffset), target.text.length)
  const nextId = createIdFactory(createId)
  const beforeBlock = makeTextBlock(nextId('text'), target.text.slice(0, safeCursor))
  const separatorBlock = makeSeparatorBlock(nextId('separator'))
  const afterBlock = makeTextBlock(nextId('text'), target.text.slice(safeCursor))
  const replacement = [beforeBlock, separatorBlock, afterBlock]
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
    separatorBlockId: separatorBlock.id,
    afterTextBlockId: afterBlock.id,
  }
}

export async function insertOanixSeparatorBlock(options: InsertOptions): Promise<OanixSeparatorBlockInsertionResult> {
  if (options.mode === 'plain' && options.existingBlocks.length > 0) return { status: 'invalid-target' }

  const plan = options.mode === 'plain'
    ? buildPlainPlan(options.text, options.cursorOffset, options.createId)
    : buildMixedPlan(options.blocks, options.targetTextBlockId, options.cursorOffset, options.createId)
  if (!plan) return { status: 'invalid-target' }

  let blocksSaved = false
  try {
    blocksSaved = await options.saveBlockChanges({
      upserts: plan.upserts,
      deletes: plan.deletes.length > 0 ? plan.deletes : undefined,
      order: plan.order,
    })
  } catch {
    blocksSaved = false
  }
  if (!blocksSaved) return { status: 'document-save-failed' }
  if (options.mode === 'mixed') return { status: 'committed', plan }

  let plainSaved = false
  try {
    plainSaved = await options.savePlainSnapshot({ title: options.title, text: '' })
  } catch {
    plainSaved = false
  }
  if (plainSaved) return { status: 'committed', plan }

  let blockRollbackSucceeded = false
  try {
    blockRollbackSucceeded = await options.saveBlockChanges({ deletes: plan.order, order: [] })
  } catch {
    blockRollbackSucceeded = false
  }
  return { status: 'plain-transition-failed', blockRollbackSucceeded }
}
