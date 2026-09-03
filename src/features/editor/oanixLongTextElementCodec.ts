import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const OANIX_LONG_TEXT_ELEMENT_KIND = 'oanix-long-text-element-v1'
export const MAX_OANIX_LONG_TEXT_PREVIEW = 720
export const MAX_OANIX_LONG_TEXT_ATTACHMENT_ID = 180

export interface OanixLongTextElement {
  id: string
  kind: typeof OANIX_LONG_TEXT_ELEMENT_KIND
  attachmentId: string
  preview: string
  utf16Length: number
  lines: number
}

/**
 * Long pasted text is stored as an OANIX attachment, not inline in the block.
 * The block keeps only enough metadata for a cheap preview so opening a note does
 * not materialize a potentially multi-megabyte clipboard payload into the editor DOM.
 */
export function encodeOanixLongTextElement(element: OanixLongTextElement): EditorSurfaceBlock {
  return {
    id: element.id,
    kind: OANIX_LONG_TEXT_ELEMENT_KIND,
    data: {
      attachmentId: element.attachmentId.slice(0, MAX_OANIX_LONG_TEXT_ATTACHMENT_ID),
      preview: element.preview.slice(0, MAX_OANIX_LONG_TEXT_PREVIEW),
      utf16Length: Math.max(0, Math.trunc(element.utf16Length)),
      lines: Math.max(1, Math.trunc(element.lines)),
    },
  }
}

export function decodeOanixLongTextElement(block: EditorSurfaceBlock): OanixLongTextElement | null {
  if (block.kind !== OANIX_LONG_TEXT_ELEMENT_KIND) return null
  const { attachmentId, preview, utf16Length, lines } = block.data
  if (typeof attachmentId !== 'string' || !attachmentId) return null
  if (typeof preview !== 'string') return null
  if (typeof utf16Length !== 'number' || !Number.isFinite(utf16Length) || utf16Length < 0) return null
  if (typeof lines !== 'number' || !Number.isFinite(lines) || lines < 1) return null

  return {
    id: block.id,
    kind: OANIX_LONG_TEXT_ELEMENT_KIND,
    attachmentId: attachmentId.slice(0, MAX_OANIX_LONG_TEXT_ATTACHMENT_ID),
    preview: preview.slice(0, MAX_OANIX_LONG_TEXT_PREVIEW),
    utf16Length: Math.trunc(utf16Length),
    lines: Math.trunc(lines),
  }
}

export function createOanixLongTextPreview(text: string): string {
  const preview = text.slice(0, MAX_OANIX_LONG_TEXT_PREVIEW)
  return preview.length < text.length ? `${preview}…` : preview
}
