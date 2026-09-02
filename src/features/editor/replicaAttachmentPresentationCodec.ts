import type { EditorSurfaceBlock } from './editorSurfaceContract'

export const REPLICA_ATTACHMENT_PRESENTATION_KIND = 'replica-attachment-presentation-v1'

export type ReplicaAttachmentAlignment = 'left' | 'center' | 'right'

export interface ReplicaAttachmentPresentation {
  id: string
  kind: typeof REPLICA_ATTACHMENT_PRESENTATION_KIND
  attachmentId: string
  widthPercent: number
  alignment: ReplicaAttachmentAlignment
  locked: boolean
  showName: boolean
  description: string
}

export const MIN_REPLICA_IMAGE_WIDTH = 34
export const MAX_REPLICA_IMAGE_WIDTH = 100
export const MAX_REPLICA_IMAGE_DESCRIPTION = 500
export const MAX_REPLICA_ATTACHMENT_ID = 180

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function clampWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 92
  return Math.min(MAX_REPLICA_IMAGE_WIDTH, Math.max(MIN_REPLICA_IMAGE_WIDTH, Math.round(value)))
}

function readAlignment(value: unknown): ReplicaAttachmentAlignment {
  return value === 'left' || value === 'right' ? value : 'center'
}

/**
 * Small durable presentation record for one attachment.
 *
 * The binary remains owned by the attachment subsystem. This block only stores
 * visual/editor metadata, so resizing or caption edits never rewrite image bytes.
 */
export function encodeReplicaAttachmentPresentation(
  presentation: ReplicaAttachmentPresentation,
): EditorSurfaceBlock {
  return {
    id: presentation.id,
    kind: REPLICA_ATTACHMENT_PRESENTATION_KIND,
    data: {
      attachmentId: presentation.attachmentId.slice(0, MAX_REPLICA_ATTACHMENT_ID),
      widthPercent: clampWidth(presentation.widthPercent),
      alignment: readAlignment(presentation.alignment),
      locked: Boolean(presentation.locked),
      showName: Boolean(presentation.showName),
      description: presentation.description.slice(0, MAX_REPLICA_IMAGE_DESCRIPTION),
    },
  }
}

export function decodeReplicaAttachmentPresentation(
  block: EditorSurfaceBlock,
): ReplicaAttachmentPresentation | null {
  if (block.kind !== REPLICA_ATTACHMENT_PRESENTATION_KIND) return null

  const attachmentId = readString(block.data.attachmentId)
  const description = readString(block.data.description)
  if (!attachmentId || description === null) return null

  return {
    id: block.id,
    kind: REPLICA_ATTACHMENT_PRESENTATION_KIND,
    attachmentId: attachmentId.slice(0, MAX_REPLICA_ATTACHMENT_ID),
    widthPercent: clampWidth(block.data.widthPercent),
    alignment: readAlignment(block.data.alignment),
    locked: block.data.locked !== false,
    showName: block.data.showName !== false,
    description: description.slice(0, MAX_REPLICA_IMAGE_DESCRIPTION),
  }
}

export function createReplicaAttachmentPresentation(
  attachmentId: string,
): ReplicaAttachmentPresentation {
  return {
    id: `attachment-presentation-${crypto.randomUUID()}`,
    kind: REPLICA_ATTACHMENT_PRESENTATION_KIND,
    attachmentId: attachmentId.slice(0, MAX_REPLICA_ATTACHMENT_ID),
    widthPercent: 92,
    alignment: 'center',
    locked: true,
    showName: true,
    description: '',
  }
}
