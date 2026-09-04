import type { EditorSurfaceBlock, EditorSurfaceBlockChangeSet, EditorSurfaceSnapshot } from './editorSurfaceContract.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
  type EditorTextBlockFormat,
} from './textBlockCodec.ts'

export interface OanixTextFormatPlan {
  blocks: EditorSurfaceBlock[]
  upserts: EditorSurfaceBlock[]
  deletes: string[]
  order: string[]
  formattedBlockIds: string[]
}

export type OanixTextFormatResult =
  | { status: 'committed'; plan: OanixTextFormatPlan }
  | { status: 'invalid-target' | 'document-save-failed' }
  | { status: 'plain-transition-failed'; blockRollbackSucceeded: boolean }

interface CommonOptions {
  format: EditorTextBlockFormat
  selectionStart: number
  selectionEnd: number
  saveBlockChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  createId?: (index: number) => string
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

type ApplyOptions = PlainOptions | MixedOptions

interface SelectedLineRange {
  start: number
  end: number
  lines: string[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function selectedLineRange(text: string, selectionStart: number, selectionEnd: number): SelectedLineRange {
  const start = clamp(Math.min(selectionStart, selectionEnd), 0, text.length)
  const end = clamp(Math.max(selectionStart, selectionEnd), 0, text.length)
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const endProbe = end > start ? Math.max(start, end - 1) : end
  const nextBreak = text.indexOf('\n', endProbe)
  const lineEnd = nextBreak < 0 ? text.length : nextBreak
  return {
    start: lineStart,
    end: lineEnd,
    lines: text.slice(lineStart, lineEnd).split('\n'),
  }
}

function chunkText(text: string): string[] {
  if (text.length === 0) return ['']
  const chunks: string[] = []
  for (let offset = 0; offset < text.length; offset += MAX_TEXT_BLOCK_TEXT_LENGTH) {
    chunks.push(text.slice(offset, offset + MAX_TEXT_BLOCK_TEXT_LENGTH))
  }
  return chunks
}

function makeIdFactory(createId?: CommonOptions['createId']) {
  let index = 0
  return () => createId?.(index++) ?? `oanix-text-${crypto.randomUUID()}`
}

function makeTextBlock(id: string, text: string, format: EditorTextBlockFormat): EditorSurfaceBlock {
  return encodeTextBlock({ id, kind: TEXT_BLOCK_KIND, text, format })
}

function splitForFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: EditorTextBlockFormat,
  preservedFormat: EditorTextBlockFormat,
  createId?: CommonOptions['createId'],
) {
  const selected = selectedLineRange(text, selectionStart, selectionEnd)
  const nextId = makeIdFactory(createId)
  const beforeRaw = text.slice(0, selected.start)
  const afterRaw = text.slice(selected.end + (selected.end < text.length && text[selected.end] === '\n' ? 1 : 0))
  const beforeText = beforeRaw.endsWith('\n') ? beforeRaw.slice(0, -1) : beforeRaw
  const selectedBlocks = selected.lines.flatMap((line) =>
    chunkText(line).map((chunk) => makeTextBlock(nextId(), chunk, format)),
  )
  const beforeBlocks = beforeText.length > 0
    ? chunkText(beforeText).map((chunk) => makeTextBlock(nextId(), chunk, preservedFormat))
    : []
  const afterBlocks = afterRaw.length > 0
    ? chunkText(afterRaw).map((chunk) => makeTextBlock(nextId(), chunk, preservedFormat))
    : []

  if (selectedBlocks.length === 0) selectedBlocks.push(makeTextBlock(nextId(), '', format))
  return { beforeBlocks, selectedBlocks, afterBlocks }
}

function buildPlainHeadingInsertionPlan(options: PlainOptions): OanixTextFormatPlan {
  const nextId = makeIdFactory(options.createId)
  const caret = clamp(options.selectionStart, 0, options.text.length)
  const lineBreak = options.text.indexOf('\n', caret)
  const lineEnd = lineBreak < 0 ? options.text.length : lineBreak
  const beforeText = options.text.slice(0, lineEnd)
  const afterText = lineBreak < 0 ? '' : options.text.slice(lineEnd + 1)
  const beforeBlocks = beforeText.length > 0
    ? chunkText(beforeText).map((chunk) => makeTextBlock(nextId(), chunk, 'paragraph'))
    : [makeTextBlock(nextId(), '', 'paragraph')]
  const heading = makeTextBlock(nextId(), '', options.format)
  const afterBlocks = afterText.length > 0
    ? chunkText(afterText).map((chunk) => makeTextBlock(nextId(), chunk, 'paragraph'))
    : []
  const blocks = [...beforeBlocks, heading, ...afterBlocks]
  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    formattedBlockIds: [heading.id],
  }
}

function buildMixedHeadingInsertionPlan(options: MixedOptions): OanixTextFormatPlan | null {
  const targetIndex = options.blocks.findIndex((block) => block.id === options.targetTextBlockId)
  if (targetIndex < 0) return null
  const target = decodeTextBlock(options.blocks[targetIndex])
  if (!target) return null

  const nextId = makeIdFactory(options.createId)
  const sourceText = target.text
  const caret = clamp(options.selectionStart, 0, sourceText.length)
  const lineBreak = sourceText.indexOf('\n', caret)
  const lineEnd = lineBreak < 0 ? sourceText.length : lineBreak
  const currentText = sourceText.slice(0, lineEnd)
  const afterText = lineBreak < 0 ? '' : sourceText.slice(lineEnd + 1)
  const current = makeTextBlock(target.id, currentText, target.format ?? 'paragraph')
  const heading = makeTextBlock(nextId(), '', options.format)
  const afterBlocks = afterText.length > 0
    ? chunkText(afterText).map((chunk) => makeTextBlock(nextId(), chunk, target.format ?? 'paragraph'))
    : []
  const replacement = [current, heading, ...afterBlocks]
  const blocks = [
    ...options.blocks.slice(0, targetIndex),
    ...replacement,
    ...options.blocks.slice(targetIndex + 1),
  ]
  return {
    blocks,
    upserts: replacement,
    deletes: [],
    order: blocks.map((block) => block.id),
    formattedBlockIds: [heading.id],
  }
}

function buildPlainPlan(options: PlainOptions): OanixTextFormatPlan {
  if ((options.format === 'h2' || options.format === 'h3') && options.selectionStart === options.selectionEnd) {
    return buildPlainHeadingInsertionPlan(options)
  }

  const split = splitForFormat(
    options.text,
    options.selectionStart,
    options.selectionEnd,
    options.format,
    'paragraph',
    options.createId,
  )
  const blocks = [...split.beforeBlocks, ...split.selectedBlocks, ...split.afterBlocks]
  return {
    blocks,
    upserts: blocks,
    deletes: [],
    order: blocks.map((block) => block.id),
    formattedBlockIds: split.selectedBlocks.map((block) => block.id),
  }
}

function buildMixedPlan(options: MixedOptions): OanixTextFormatPlan | null {
  if ((options.format === 'h2' || options.format === 'h3') && options.selectionStart === options.selectionEnd) {
    return buildMixedHeadingInsertionPlan(options)
  }

  const targetIndex = options.blocks.findIndex((block) => block.id === options.targetTextBlockId)
  if (targetIndex < 0) return null
  const target = decodeTextBlock(options.blocks[targetIndex])
  if (!target) return null

  const split = splitForFormat(
    target.text,
    options.selectionStart,
    options.selectionEnd,
    options.format,
    target.format ?? 'paragraph',
    options.createId,
  )
  const replacement = [...split.beforeBlocks, ...split.selectedBlocks, ...split.afterBlocks]
  const blocks = [
    ...options.blocks.slice(0, targetIndex),
    ...replacement,
    ...options.blocks.slice(targetIndex + 1),
  ]
  return {
    blocks,
    upserts: replacement,
    deletes: [target.id],
    order: blocks.map((block) => block.id),
    formattedBlockIds: split.selectedBlocks.map((block) => block.id),
  }
}

export async function applyOanixTextFormat(options: ApplyOptions): Promise<OanixTextFormatResult> {
  if (options.mode === 'plain' && options.existingBlocks.length > 0) return { status: 'invalid-target' }

  const plan = options.mode === 'plain' ? buildPlainPlan(options) : buildMixedPlan(options)
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
