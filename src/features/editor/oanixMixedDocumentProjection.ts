import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'
import { decodeOanixImageElement, type OanixImageElement } from './oanixImageElementCodec.ts'
import { decodeTextBlock, type EditorTextBlock } from './textBlockCodec.ts'

export type OanixMixedDocumentNode =
  | { type: 'text'; block: EditorTextBlock }
  | { type: 'image'; block: OanixImageElement }
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

    return { type: 'unsupported', block }
  })
}

export function hasRenderableOanixMixedContent(blocks: readonly EditorSurfaceBlock[]): boolean {
  return projectOanixMixedDocument(blocks).some((node) => node.type === 'text' || node.type === 'image')
}
