import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'
import { decodeChecklistBlock, type EditorChecklistBlock } from './checklistBlockCodec.ts'
import { decodeCodeBlock, type EditorCodeBlock } from './codeBlockCodec.ts'
import { decodeContactBlock, type EditorContactBlock } from './contactBlockCodec.ts'
import { decodeOanixFileGroupElement, type OanixFileGroupElement } from './oanixFileGroupElementCodec.ts'
import { decodeOanixImageElement, type OanixImageElement } from './oanixImageElementCodec.ts'
import { decodeOanixLongTextElement, type OanixLongTextElement } from './oanixLongTextElementCodec.ts'
import { decodeSeparatorBlock, type EditorSeparatorBlock } from './separatorBlockCodec.ts'
import { decodeTextBlock, type EditorTextBlock } from './textBlockCodec.ts'

export type OanixMixedDocumentNode =
  | { type: 'text'; block: EditorTextBlock }
  | { type: 'image'; block: OanixImageElement }
  | { type: 'file-group'; block: OanixFileGroupElement }
  | { type: 'code'; block: EditorCodeBlock }
  | { type: 'checklist'; block: EditorChecklistBlock }
  | { type: 'contact'; block: EditorContactBlock }
  | { type: 'separator'; block: EditorSeparatorBlock }
  | { type: 'long-text'; block: OanixLongTextElement }
  | { type: 'unsupported'; block: EditorSurfaceBlock }

/** Converts persisted rich blocks into the mixed-document vocabulary rendered by OANIX Notes. */
export function projectOanixMixedDocument(blocks: readonly EditorSurfaceBlock[]): OanixMixedDocumentNode[] {
  return blocks.map((block) => {
    const text = decodeTextBlock(block)
    if (text) return { type: 'text', block: text }
    const image = decodeOanixImageElement(block)
    if (image) return { type: 'image', block: image }
    const fileGroup = decodeOanixFileGroupElement(block)
    if (fileGroup) return { type: 'file-group', block: fileGroup }
    const code = decodeCodeBlock(block)
    if (code) return { type: 'code', block: code }
    const checklist = decodeChecklistBlock(block)
    if (checklist) return { type: 'checklist', block: checklist }
    const contact = decodeContactBlock(block)
    if (contact) return { type: 'contact', block: contact }
    const separator = decodeSeparatorBlock(block)
    if (separator) return { type: 'separator', block: separator }
    const longText = decodeOanixLongTextElement(block)
    if (longText) return { type: 'long-text', block: longText }
    return { type: 'unsupported', block }
  })
}

export function hasRenderableOanixMixedContent(blocks: readonly EditorSurfaceBlock[]): boolean {
  return projectOanixMixedDocument(blocks).some((node) => (
    node.type === 'text'
    || node.type === 'image'
    || node.type === 'file-group'
    || node.type === 'code'
    || node.type === 'checklist'
    || node.type === 'contact'
    || node.type === 'separator'
    || node.type === 'long-text'
  ))
}
