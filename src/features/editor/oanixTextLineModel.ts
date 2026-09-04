import type { EditorTextBlock, EditorTextBlockFormat } from './textBlockCodec.ts'

export interface TextLineEditResult {
  lines: EditorTextBlock[]
  focusBlockId: string
  focusOffset: number
  upserts: EditorTextBlock[]
  deletes: string[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function paragraphIfEmpty(line: EditorTextBlock): EditorTextBlock {
  if (line.text.trim().length > 0 || line.format === 'paragraph') return line
  return { ...line, format: 'paragraph' }
}

export function normalizeTextLines(
  source: readonly EditorTextBlock[],
  createId: () => string,
): { lines: EditorTextBlock[]; changed: boolean; replacementBySourceId: Map<string, EditorTextBlock[]> } {
  const lines: EditorTextBlock[] = []
  const replacementBySourceId = new Map<string, EditorTextBlock[]>()
  let changed = false

  for (const block of source) {
    const pieces = block.text.split('\n')
    if (pieces.length === 1) {
      const normalized = paragraphIfEmpty({ ...block })
      if (normalized.format !== block.format) changed = true
      lines.push(normalized)
      replacementBySourceId.set(block.id, [normalized])
      continue
    }

    changed = true
    const replacement = pieces.map((text, index) => paragraphIfEmpty({
      ...block,
      id: index === 0 ? block.id : createId(),
      text,
      format: index === 0 ? block.format : block.format === 'paragraph' ? 'paragraph' : 'paragraph',
    }))
    lines.push(...replacement)
    replacementBySourceId.set(block.id, replacement)
  }

  return { lines, changed, replacementBySourceId }
}

export function applyTextLineFormat(
  source: readonly EditorTextBlock[],
  blockId: string,
  selectionStart: number,
  selectionEnd: number,
  format: EditorTextBlockFormat,
  createId: () => string,
): TextLineEditResult | null {
  const index = source.findIndex((line) => line.id === blockId)
  if (index < 0) return null
  const target = source[index]
  const start = clamp(Math.min(selectionStart, selectionEnd), 0, target.text.length)
  const end = clamp(Math.max(selectionStart, selectionEnd), 0, target.text.length)
  const selectedText = target.text.slice(start, end)

  if ((format === 'h2' || format === 'h3') && start === end && target.text.trim().length > 0) {
    const inserted: EditorTextBlock = {
      id: createId(),
      kind: target.kind,
      text: '',
      format,
    }
    return {
      lines: [...source.slice(0, index + 1), inserted, ...source.slice(index + 1)],
      focusBlockId: inserted.id,
      focusOffset: 0,
      upserts: [inserted],
      deletes: [],
    }
  }

  const shouldApplySelection = start !== end && selectedText.trim().length > 0
  const next: EditorTextBlock = {
    ...target,
    format: shouldApplySelection || target.text.trim().length === 0 || (format !== 'h2' && format !== 'h3')
      ? format
      : target.format,
  }
  if (next.format === target.format) return null

  return {
    lines: source.map((line, lineIndex) => lineIndex === index ? next : line),
    focusBlockId: next.id,
    focusOffset: end,
    upserts: [next],
    deletes: [],
  }
}

export function enterTextLine(
  source: readonly EditorTextBlock[],
  blockId: string,
  selectionStart: number,
  selectionEnd: number,
  createId: () => string,
): TextLineEditResult | null {
  const index = source.findIndex((line) => line.id === blockId)
  if (index < 0) return null
  const target = source[index]
  const start = clamp(Math.min(selectionStart, selectionEnd), 0, target.text.length)
  const end = clamp(Math.max(selectionStart, selectionEnd), 0, target.text.length)
  const current = paragraphIfEmpty({ ...target, text: target.text.slice(0, start) })
  const next: EditorTextBlock = {
    id: createId(),
    kind: target.kind,
    text: target.text.slice(end),
    format: 'paragraph',
  }

  return {
    lines: [...source.slice(0, index), current, next, ...source.slice(index + 1)],
    focusBlockId: next.id,
    focusOffset: 0,
    upserts: [current, next],
    deletes: [],
  }
}

export function backspaceTextLineBoundary(
  source: readonly EditorTextBlock[],
  blockId: string,
): TextLineEditResult | null {
  const index = source.findIndex((line) => line.id === blockId)
  if (index <= 0) return null
  const current = source[index]
  const previous = source[index - 1]
  const joinOffset = previous.text.length
  const merged = paragraphIfEmpty({ ...previous, text: previous.text + current.text })

  return {
    lines: [...source.slice(0, index - 1), merged, ...source.slice(index + 1)],
    focusBlockId: merged.id,
    focusOffset: joinOffset,
    upserts: [merged],
    deletes: [current.id],
  }
}
