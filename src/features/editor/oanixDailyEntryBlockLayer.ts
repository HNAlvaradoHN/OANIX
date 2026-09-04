import type { EditorSurfaceBlock, EditorSurfaceBlockChangeSet, EditorSurfaceSnapshot } from './editorSurfaceContract.ts'
import {
  DAILY_ENTRY_BLOCK_KIND,
  encodeDailyEntryBlock,
  localDailyEntryDateKey,
} from './dailyEntryBlockCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
} from './textBlockCodec.ts'

export interface OanixDailyEntryBlockPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  dailyEntryBlockId: string
  afterTextBlockId: string
}

export type OanixDailyEntryBlockInsertionResult =
  | { status: 'committed'; plan: OanixDailyEntryBlockPlan }
  | { status: 'invalid-target' | 'document-save-failed' }
  | { status: 'plain-transition-failed'; blockRollbackSucceeded: boolean }

interface CommonOptions {
  cursorOffset: number
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  now?: Date
  createId?: (kind: 'text' | 'daily-entry', index: number) => string
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
  const counters = { text: 0, 'daily-entry': 0 }
  return (kind: 'text' | 'daily-entry') => {
    const index = counters[kind]++
    return createId?.(kind, index) ?? `oanix-${kind}-${crypto.randomUUID()}`
  }
}

function makeTextBlock(id: string, text: string): EditorSurfaceBlock {
  return encodeTextBlock({ id, kind: TEXT_BLOCK_KIND, text })
}

function makeDailyEntryBlock(id: string, now: Date): EditorSurfaceBlock {
  return encodeDailyEntryBlock({
    id,
    kind: DAILY_ENTRY_BLOCK_KIND,
    date: localDailyEntryDateKey(now),
    title: '',
    text: '',
  })
}

function buildPlainPlan(text: string, cursorOffset: number, now: Date, createId?: CommonOptions['createId']): OanixDailyEntryBlockPlan {
  const safeCursor = Math.min(Math.max(0, cursorOffset), text.length)
  const nextId = createIdFactory(createId)
  const beforeBlocks = chunkText(text.slice(0, safeCursor)).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const dailyEntryBlock = makeDailyEntryBlock(nextId('daily-entry'), now)
  const afterBlocks = chunkText(text.slice(safeCursor)).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const blocks = [...beforeBlocks, dailyEntryBlock, ...afterBlocks]
  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    dailyEntryBlockId: dailyEntryBlock.id,
    afterTextBlockId: afterBlocks[0].id,
  }
}

function buildMixedPlan(
  originalBlocks: readonly EditorSurfaceBlock[],
  targetTextBlockId: string,
  cursorOffset: number,
  now: Date,
  createId?: CommonOptions['createId'],
): OanixDailyEntryBlockPlan | null {
  const targetIndex = originalBlocks.findIndex((block) => block.id === targetTextBlockId)
  if (targetIndex < 0) return null
  const target = decodeTextBlock(originalBlocks[targetIndex])
  if (!target) return null

  const safeCursor = Math.min(Math.max(0, cursorOffset), target.text.length)
  const nextId = createIdFactory(createId)
  const beforeBlock = makeTextBlock(nextId('text'), target.text.slice(0, safeCursor))
  const dailyEntryBlock = makeDailyEntryBlock(nextId('daily-entry'), now)
  const afterBlock = makeTextBlock(nextId('text'), target.text.slice(safeCursor))
  const replacement = [beforeBlock, dailyEntryBlock, afterBlock]
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
    dailyEntryBlockId: dailyEntryBlock.id,
    afterTextBlockId: afterBlock.id,
  }
}

export async function insertOanixDailyEntryBlock(options: InsertOptions): Promise<OanixDailyEntryBlockInsertionResult> {
  if (options.mode === 'plain' && options.existingBlocks.length > 0) return { status: 'invalid-target' }
  const now = options.now ?? new Date()
  const plan = options.mode === 'plain'
    ? buildPlainPlan(options.text, options.cursorOffset, now, options.createId)
    : buildMixedPlan(options.blocks, options.targetTextBlockId, options.cursorOffset, now, options.createId)
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
