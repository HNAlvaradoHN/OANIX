import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const OANIX_IMAGE_ELEMENT_KIND = 'oanix-image-element-v1'
export const MAX_OANIX_ATTACHMENT_ID_LENGTH = 180
export const DEFAULT_OANIX_IMAGE_WIDTH_PERCENT = 100
export const MIN_OANIX_IMAGE_WIDTH_PERCENT = 24
export const MAX_OANIX_IMAGE_WIDTH_PERCENT = 100

export interface OanixImageElement {
  id: string
  kind: typeof OANIX_IMAGE_ELEMENT_KIND
  attachmentId: string
  widthPercent: number
  sizeLocked: boolean
}

function normalizeWidthPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_OANIX_IMAGE_WIDTH_PERCENT
  return Math.min(MAX_OANIX_IMAGE_WIDTH_PERCENT, Math.max(MIN_OANIX_IMAGE_WIDTH_PERCENT, Math.round(value)))
}

/**
 * Persists only opaque attachment identity and cheap presentation metadata inside
 * note block order. Image bytes, provider metadata, object URLs and encrypted storage
 * details stay in the attachment subsystem.
 */
export function encodeOanixImageElement(element: OanixImageElement): EditorSurfaceBlock {
  return {
    id: element.id,
    kind: OANIX_IMAGE_ELEMENT_KIND,
    data: {
      attachmentId: element.attachmentId.slice(0, MAX_OANIX_ATTACHMENT_ID_LENGTH),
      widthPercent: normalizeWidthPercent(element.widthPercent),
      sizeLocked: Boolean(element.sizeLocked),
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
    widthPercent: normalizeWidthPercent(block.data.widthPercent),
    sizeLocked: block.data.sizeLocked === true,
  }
}

export function createOanixImageElement(attachmentId: string): OanixImageElement {
  return {
    id: `oanix-image-${crypto.randomUUID()}`,
    kind: OANIX_IMAGE_ELEMENT_KIND,
    attachmentId: attachmentId.slice(0, MAX_OANIX_ATTACHMENT_ID_LENGTH),
    widthPercent: DEFAULT_OANIX_IMAGE_WIDTH_PERCENT,
    sizeLocked: false,
  }
}
