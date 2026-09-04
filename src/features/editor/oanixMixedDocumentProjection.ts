import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'
import { decodeChecklistBlock, type EditorChecklistBlock } from './checklistBlockCodec.ts'
import { decodeCodeBlock, type EditorCodeBlock } from './codeBlockCodec.ts'
import { decodeOanixFileGroupElement, type OanixFileGroupElement } from './oanixFileGroupElementCodec.ts'
import { decodeOanixImageElement, type OanixImageElement } from './oanixImageElementCodec.ts'
import { decodeOanixLongTextElement, type OanixLongTextElement } from './oanixLongTextElementCodec.ts'
import { decodeTextBlock, type EditorTextBlock } from './textBlockCodec.ts'

export type OanixMixedDocumentNode =
  | { type: 'text'; block: EditorTextBlock }
  | { type: 'image'; block: OanixImageElement }
  | { type: 'file-group'; block: OanixFileGroupElement }
  | { type: 'code'; block: EditorCodeBlock }
  | { type: 'checklist'; block: EditorChecklistBlock }
  | { type: 'long-text'; block: OanixLongTextElement }
  | { type: 'unsupported'; block: EditorSurfaceBlock }

/**
 * Converts persisted rich blocks into the minimal mixed-document vocabulary that
 * OANIX Notes can render today. Unknown blocks are preserved as explicit nodes
 * instead of being discarded, so adding a renderer later cannot silently lose data.
 */
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
    || node.type === 'long-text'
  ))
}
