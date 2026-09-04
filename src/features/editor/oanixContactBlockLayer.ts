import type { EditorSurfaceBlock, EditorSurfaceBlockChangeSet, EditorSurfaceSnapshot } from './editorSurfaceContract.ts'
import { CONTACT_BLOCK_KIND, encodeContactBlock } from './contactBlockCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
} from './textBlockCodec.ts'

export interface OanixContactBlockPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  contactBlockId: string
  afterTextBlockId: string
}

export type OanixContactBlockInsertionResult =
  | { status: 'committed'; plan: OanixContactBlockPlan }
  | { status: 'invalid-target' | 'document-save-failed' }
  | { status: 'plain-transition-failed'; blockRollbackSucceeded: boolean }

interface CommonOptions {
  cursorOffset: number
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  createId?: (kind: 'text' | 'contact', index: number) => string
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
  for (let offset = 0; offset < text.length; offset += MAX_TEXT_BLOCK_TEXT_LENGTH) chunks.push(text.slice(offset, offset + MAX_TEXT_BLOCK_TEXT_LENGTH))
  return chunks
}

function idFactory(createId?: CommonOptions['createId']) {
  const counters = { text: 0, contact: 0 }
  return (kind: 'text' | 'contact') => createId?.(kind, counters[kind]++) ?? `oanix-${kind}-${crypto.randomUUID()}`
}

function textBlock(id: string, text: string): EditorSurfaceBlock {
  return encodeTextBlock({ id, kind: TEXT_BLOCK_KIND, text })
}

function contactBlock(id: string): EditorSurfaceBlock {
  return encodeContactBlock({
    id,
    kind: CONTACT_BLOCK_KIND,
    name: 'Nuevo contacto',
    phone: '',
    email: '',
    organization: '',
    notes: '',
  })
}

function plainPlan(text: string, cursorOffset: number, createId?: CommonOptions['createId']): OanixContactBlockPlan {
  const cursor = Math.min(Math.max(0, cursorOffset), text.length)
  const nextId = idFactory(createId)
  const before = chunkText(text.slice(0, cursor)).map((chunk) => textBlock(nextId('text'), chunk))
  const contact = contactBlock(nextId('contact'))
  const after = chunkText(text.slice(cursor)).map((chunk) => textBlock(nextId('text'), chunk))
  const blocks = [...before, contact, ...after]
  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    contactBlockId: contact.id,
    afterTextBlockId: after[0].id,
  }
}

function mixedPlan(blocks: readonly EditorSurfaceBlock[], targetId: string, cursorOffset: number, createId?: CommonOptions['createId']): OanixContactBlockPlan | null {
  const index = blocks.findIndex((block) => block.id === targetId)
  if (index < 0) return null
  const target = decodeTextBlock(blocks[index])
  if (!target) return null
  const cursor = Math.min(Math.max(0, cursorOffset), target.text.length)
  const nextId = idFactory(createId)
  const before = textBlock(nextId('text'), target.text.slice(0, cursor))
  const contact = contactBlock(nextId('contact'))
  const after = textBlock(nextId('text'), target.text.slice(cursor))
  const replacement = [before, contact, after]
  const nextBlocks = [...blocks.slice(0, index), ...replacement, ...blocks.slice(index + 1)]
  return {
    blocks: nextBlocks,
    upserts: replacement,
    deletes: [targetId],
    order: nextBlocks.map((block) => block.id),
    contactBlockId: contact.id,
    afterTextBlockId: after.id,
  }
}

export async function insertOanixContactBlock(options: InsertOptions): Promise<OanixContactBlockInsertionResult> {
  if (options.mode === 'plain' && options.existingBlocks.length > 0) return { status: 'invalid-target' }
  const plan = options.mode === 'plain'
    ? plainPlan(options.text, options.cursorOffset, options.createId)
    : mixedPlan(options.blocks, options.targetTextBlockId, options.cursorOffset, options.createId)
  if (!plan) return { status: 'invalid-target' }

  let blocksSaved = false
  try {
    blocksSaved = await options.saveBlockChanges({ upserts: plan.upserts, deletes: plan.deletes.length ? plan.deletes : undefined, order: plan.order })
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
