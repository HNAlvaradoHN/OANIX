import type { EditorSurfaceBlock, EditorSurfaceBlockChangeSet, EditorSurfaceSnapshot } from './editorSurfaceContract.ts'
import { CHECKLIST_BLOCK_KIND, encodeChecklistBlock } from './checklistBlockCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
} from './textBlockCodec.ts'

export interface OanixChecklistBlockPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  checklistBlockId: string
  afterTextBlockId: string
}

export type OanixChecklistBlockInsertionResult =
  | { status: 'committed'; plan: OanixChecklistBlockPlan }
  | { status: 'invalid-target' | 'document-save-failed' }
  | { status: 'plain-transition-failed'; blockRollbackSucceeded: boolean }

interface CommonOptions {
  cursorOffset: number
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  createId?: (kind: 'text' | 'checklist', index: number) => string
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

function createIdFactory(createId?: (kind: 'text' | 'checklist', index: number) => string) {
  const counters = { text: 0, checklist: 0 }
  return (kind: 'text' | 'checklist') => {
    const index = counters[kind]++
    return createId?.(kind, index) ?? `oanix-${kind}-${crypto.randomUUID()}`
  }
}

function makeTextBlock(id: string, text: string): EditorSurfaceBlock {
  return encodeTextBlock({ id, kind: TEXT_BLOCK_KIND, text })
}

function makeChecklistBlock(id: string): EditorSurfaceBlock {
  return encodeChecklistBlock({
    id,
    kind: CHECKLIST_BLOCK_KIND,
    items: [{ text: '', checked: false }],
  })
}

function buildPlainPlan(
  text: string,
  cursorOffset: number,
  createId?: (kind: 'text' | 'checklist', index: number) => string,
): OanixChecklistBlockPlan {
  const safeCursor = Math.min(Math.max(0, cursorOffset), text.length)
  const nextId = createIdFactory(createId)
  const beforeBlocks = chunkText(text.slice(0, safeCursor)).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const checklistBlock = makeChecklistBlock(nextId('checklist'))
  const afterBlocks = chunkText(text.slice(safeCursor)).map((chunk) => makeTextBlock(nextId('text'), chunk))
  const blocks = [...beforeBlocks, checklistBlock, ...afterBlocks]
  const afterTextBlockId = afterBlocks[0]?.id
  if (!afterTextBlockId) throw new Error('Checklist requires a trailing text block.')

  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    checklistBlockId: checklistBlock.id,
    afterTextBlockId,
  }
}

function buildMixedPlan(
  originalBlocks: readonly EditorSurfaceBlock[],
  targetTextBlockId: string,
  cursorOffset: number,
  createId?: (kind: 'text' | 'checklist', index: number) => string,
): OanixChecklistBlockPlan | null {
  const targetIndex = originalBlocks.findIndex((block) => block.id === targetTextBlockId)
  if (targetIndex < 0) return null
  const target = decodeTextBlock(originalBlocks[targetIndex])
  if (!target) return null

  const safeCursor = Math.min(Math.max(0, cursorOffset), target.text.length)
  const nextId = createIdFactory(createId)
  const beforeBlock = makeTextBlock(nextId('text'), target.text.slice(0, safeCursor))
  const checklistBlock = makeChecklistBlock(nextId('checklist'))
  const afterBlock = makeTextBlock(nextId('text'), target.text.slice(safeCursor))
  const replacement = [beforeBlock, checklistBlock, afterBlock]
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
    checklistBlockId: checklistBlock.id,
    afterTextBlockId: afterBlock.id,
  }
}

export async function insertOanixChecklistBlock(options: InsertOptions): Promise<OanixChecklistBlockInsertionResult> {
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
