import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const OANIX_IMAGE_ELEMENT_KIND = 'oanix-image-element-v1'
export const MAX_OANIX_ATTACHMENT_ID_LENGTH = 180

export interface OanixImageElement {
  id: string
  kind: typeof OANIX_IMAGE_ELEMENT_KIND
  attachmentId: string
}

/**
 * Persists only the opaque attachment identity inside note block order.
 * Image bytes, provider metadata, object URLs and encrypted storage details stay in
 * the attachment subsystem. This block can therefore move/reorder cheaply.
 */
export function encodeOanixImageElement(element: OanixImageElement): EditorSurfaceBlock {
  return {
    id: element.id,
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: {
      attachmentId: element.attachmentId.slice(0, MAX_OANIX_ATTACHMENT_ID_LENGTH),
    },
  }
}

export function decodeOanixImageElement(block: EditorSurfaceBlock): OanixImageElement | null {
  if (block.kind !== OANIX_IMAGE_ELEMENT_KIND) return null
  const attachmentId = block.data.attachmentId
  if (typeof attachmentId !== 'string' || !attachmentId) return null

  return {
    id: block.id,
    kind: OANIX_IMAGE_ELEMENT_KIND,
    attachmentId: attachmentId.slice(0, MAX_OANIX_ATTACHMENT_ID_LENGTH),
  }
}

export function createOanixImageElement(attachmentId: string): OanixImageElement {
  return {
    id: `oanix-image-${crypto.randomUUID()}`,
    kind: OANIX_IMAGE_ELEMENT_KIND,
    attachmentId: attachmentId.slice(0, MAX_OANIX_ATTACHMENT_ID_LENGTH),
  }
}
