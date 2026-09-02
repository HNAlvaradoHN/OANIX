import type { EditorSurfaceBlock } from './editorSurfaceContract'

export const REPLICA_ATTACHMENT_FLOW_KIND = 'replica-attachment-flow-v1'
export const MAX_REPLICA_FLOW_ATTACHMENT_ID = 180

export type ReplicaAttachmentFlowType = 'image' | 'file'

export interface ReplicaAttachmentFlowRef {
  id: string
  kind: typeof REPLICA_ATTACHMENT_FLOW_KIND
  attachmentId: string
  attachmentType: ReplicaAttachmentFlowType
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readAttachmentType(value: unknown): ReplicaAttachmentFlowType | null {
  return value === 'image' || value === 'file' ? value : null
}

/**
 * Small ordering anchor for one encrypted attachment inside the rich-block flow.
 *
 * This never owns attachment bytes, URLs, provider details or presentation state.
 * The attachment subsystem remains the binary authority; this record only lets the
 * editor persist where that opaque attachment reference sits among text/checklist/etc.
 */
export function encodeReplicaAttachmentFlowRef(ref: ReplicaAttachmentFlowRef): EditorSurfaceBlock {
  return {
    id: ref.id,
    kind: REPLICA_ATTACHMENT_FLOW_KIND,
    data: {
      attachmentId: ref.attachmentId.slice(0, MAX_REPLICA_FLOW_ATTACHMENT_ID),
      attachmentType: ref.attachmentType,
    },
  }
}

export function decodeReplicaAttachmentFlowRef(block: EditorSurfaceBlock): ReplicaAttachmentFlowRef | null {
  if (block.kind !== REPLICA_ATTACHMENT_FLOW_KIND) return null

  const attachmentId = readString(block.data.attachmentId)
  const attachmentType = readAttachmentType(block.data.attachmentType)
  if (!attachmentId || !attachmentType) return null

  return {
    id: block.id,
    kind: REPLICA_ATTACHMENT_FLOW_KIND,
    attachmentId: attachmentId.slice(0, MAX_REPLICA_FLOW_ATTACHMENT_ID),
    attachmentType,
  }
}

export function createReplicaAttachmentFlowRef(
  attachmentId: string,
  attachmentType: ReplicaAttachmentFlowType,
): ReplicaAttachmentFlowRef {
  return {
    id: `attachment-flow-${crypto.randomUUID()}`,
    kind: REPLICA_ATTACHMENT_FLOW_KIND,
    attachmentId: attachmentId.slice(0, MAX_REPLICA_FLOW_ATTACHMENT_ID),
    attachmentType,
  }
}
