import {
  DEFAULT_NOTE_SHEET_APPEARANCE,
  normalizeNoteLink,
  type FileBlock,
  type NoteSheetAppearance,
  type RichTextRun,
  type StoredNoteBlock,
} from '../../noteTypes'
import type { AttachmentMetadata } from '../../../attachments/attachmentTypes'

export type NativeTextBlock = Extract<
  StoredNoteBlock,
  { type: 'paragraph' | 'heading' | 'quote' | 'bulletList' | 'orderedList' }
>

export function createNativeBlockId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random generation is not available.')
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function isNativeTextBlock(block: StoredNoteBlock | undefined): block is NativeTextBlock {
  return Boolean(block && ['paragraph', 'heading', 'quote', 'bulletList', 'orderedList'].includes(block.type))
}

export function isNativeContentBlock(block: StoredNoteBlock | undefined): boolean {
  return Boolean(block && ['dailyEntry', 'image', 'code', 'checklist', 'contact', 'divider', 'file'].includes(block.type))
}

export function emptyParagraph(): StoredNoteBlock {
  return { id: createNativeBlockId(), type: 'paragraph', runs: [] }
}

export function ensureNativeBlockFlow(input: StoredNoteBlock[]): StoredNoteBlock[] {
  if (input.length === 0) return [emptyParagraph()]
  const output: StoredNoteBlock[] = []

  input.forEach((block) => {
    if (isNativeContentBlock(block) && !isNativeTextBlock(output.at(-1))) output.push(emptyParagraph())
    output.push(block)
  })

  if (!isNativeTextBlock(output.at(-1))) output.push(emptyParagraph())
  return output
}

export function normalizeNativeSheetBlocks(input: StoredNoteBlock[]): StoredNoteBlock[] {
  const source = structuredClone(input)
  const withBodies: StoredNoteBlock[] = []

  for (let index = 0; index < source.length; index += 1) {
    const block = source[index]
    withBodies.push(block)
    if (block.type !== 'dailyEntry') continue

    const body = source[index + 1]
    if (body?.type === 'paragraph') {
      withBodies.push(body)
      index += 1
    } else {
      withBodies.push(emptyParagraph())
    }

    const following = source[index + 1]
    if (!isNativeTextBlock(following)) {
      withBodies.push(emptyParagraph())
    }
  }

  return ensureNativeBlockFlow(withBodies)
}

export function appearanceForNote(value: NoteSheetAppearance | undefined): NoteSheetAppearance {
  return value ? { ...value } : { ...DEFAULT_NOTE_SHEET_APPEARANCE }
}

export function runsPlainText(runs: RichTextRun[]): string {
  return runs.map((run) => run.text).join('')
}

export function blockPlainText(block: StoredNoteBlock): string {
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') {
    return runsPlainText(block.runs)
  }
  if (block.type === 'bulletList' || block.type === 'orderedList') {
    return block.items.map(runsPlainText).join('\n')
  }
  if (block.type === 'checklist') return block.items.map((item) => item.text).join('\n')
  if (block.type === 'contact') return [block.name, block.organization, block.phone, block.email, block.notes].join('\n')
  if (block.type === 'dailyEntry') return block.title
  if (block.type === 'code') return block.text
  if (block.type === 'image') return block.alt || (block.showName === false ? '' : block.name)
  return ''
}

export function noteReadingMinutes(blocks: StoredNoteBlock[]): number {
  const words = blocks
    .map(blockPlainText)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function noteWordCount(blocks: StoredNoteBlock[]): number {
  return blocks.map(blockPlainText).join(' ').trim().split(/\s+/).filter(Boolean).length
}

export function noteCharacterCount(blocks: StoredNoteBlock[]): number {
  return blocks.map(blockPlainText).join('\n').length
}

function sameMarks(left: RichTextRun, right: RichTextRun): boolean {
  return Boolean(left.bold) === Boolean(right.bold)
    && Boolean(left.italic) === Boolean(right.italic)
    && (left.href ?? '') === (right.href ?? '')
}

export function mergeRichRuns(runs: RichTextRun[]): RichTextRun[] {
  const merged: RichTextRun[] = []
  for (const run of runs) {
    if (!run.text) continue
    const previous = merged.at(-1)
    if (previous && sameMarks(previous, run)) {
      previous.text += run.text
    } else {
      merged.push({ ...run })
    }
  }
  return merged
}

export function runsFromDom(root: HTMLElement): RichTextRun[] {
  const runs: RichTextRun[] = []

  function walk(node: Node, marks: Omit<RichTextRun, 'text'>) {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push({ text: node.textContent ?? '', ...marks })
      return
    }
    if (!(node instanceof HTMLElement)) return

    const tag = node.tagName.toLowerCase()
    const style = node.style
    const next = { ...marks }
    if (tag === 'strong' || tag === 'b' || /bold|[6-9]00/.test(style.fontWeight)) next.bold = true
    if (tag === 'em' || tag === 'i' || style.fontStyle === 'italic') next.italic = true
    if (tag === 'a') {
      const href = normalizeNoteLink(node.getAttribute('href') ?? '')
      if (href) next.href = href
    }

    Array.from(node.childNodes).forEach((child) => walk(child, next))
    if (tag === 'br') runs.push({ text: '\n', ...next })
  }

  const children = Array.from(root.childNodes)
  const blockLike = new Set(['p', 'div', 'h1', 'h2', 'h3', 'blockquote'])
  children.forEach((child, index) => {
    walk(child, {})
    const tag = child instanceof HTMLElement ? child.tagName.toLowerCase() : ''
    if (index < children.length - 1 && blockLike.has(tag)) runs.push({ text: '\n' })
  })
  return mergeRichRuns(runs)
}

function runsFromListItem(item: Element): RichTextRun[] {
  const holder = document.createElement('div')
  holder.innerHTML = item.innerHTML
  return runsFromDom(holder)
}

export function textBlockFromDom(blockId: string, body: HTMLElement): NativeTextBlock {
  const first = body.firstElementChild
  const tag = first?.tagName.toLowerCase() ?? 'p'

  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(first?.children ?? []).map(runsFromListItem)
    return tag === 'ul'
      ? { id: blockId, type: 'bulletList', items }
      : { id: blockId, type: 'orderedList', items }
  }

  const runs = runsFromDom(body)
  if (tag === 'h2') return { id: blockId, type: 'heading', level: 2, runs }
  if (tag === 'h3') return { id: blockId, type: 'heading', level: 3, runs }
  if (tag === 'blockquote') return { id: blockId, type: 'quote', runs }
  return { id: blockId, type: 'paragraph', runs }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function runsToHtml(runs: RichTextRun[]): string {
  return runs.map((run) => {
    let value = escapeHtml(run.text).replace(/\n/g, '<br>')
    if (run.bold) value = `<strong>${value}</strong>`
    if (run.italic) value = `<i>${value}</i>`
    if (run.href) value = `<a href="${escapeHtml(run.href)}">${value}</a>`
    return value
  }).join('')
}

export function textBlockToHtml(block: NativeTextBlock): string {
  if (block.type === 'paragraph') return `<p>${runsToHtml(block.runs) || '<br>'}</p>`
  if (block.type === 'heading') {
    const tag = block.level === 3 ? 'h3' : 'h2'
    return `<${tag}>${runsToHtml(block.runs) || '<br>'}</${tag}>`
  }
  if (block.type === 'quote') return `<blockquote>${runsToHtml(block.runs) || '<br>'}</blockquote>`
  const tag = block.type === 'bulletList' ? 'ul' : 'ol'
  const items = block.items.length > 0 ? block.items : [[]]
  return `<${tag}>${items.map((item) => `<li>${runsToHtml(item) || '<br>'}</li>`).join('')}</${tag}>`
}

export function attachUnreferencedFiles(
  blocks: StoredNoteBlock[],
  attachments: AttachmentMetadata[],
): { blocks: StoredNoteBlock[]; added: boolean } {
  if (attachments.length === 0) return { blocks, added: false }
  const referenced = new Set(
    blocks.flatMap((block) => block.type === 'file' ? block.attachmentIds : []),
  )
  const missing = attachments
    .map((item) => item.attachmentId)
    .filter((attachmentId) => !referenced.has(attachmentId))
  if (missing.length === 0) return { blocks, added: false }

  const fileBlock: FileBlock = {
    id: createNativeBlockId(),
    type: 'file',
    attachmentIds: missing,
  }
  const next = [...blocks]
  const trailingIndex = next.length - 1
  if (trailingIndex >= 0 && isNativeTextBlock(next[trailingIndex])) next.splice(trailingIndex, 0, fileBlock)
  else next.push(fileBlock)
  return { blocks: ensureNativeBlockFlow(next), added: true }
}
