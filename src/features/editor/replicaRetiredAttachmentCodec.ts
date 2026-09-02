import type { EditorSurfaceBlock } from './editorSurfaceContract'

export const REPLICA_RETIRED_ATTACHMENT_KIND = 'replica-retired-attachment-v1'
export const MAX_REPLICA_RETIRED_ATTACHMENT_ID = 180

export interface ReplicaRetiredAttachment {
  id: string
  kind: typeof REPLICA_RETIRED_ATTACHMENT_KIND
  attachmentId: string
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Durable tombstone for an attachment intentionally removed from the visible flow.
 *
 * It stores only the opaque attachment id. The marker lives in EditorBlockSession so
 * initial legacy migration can distinguish a genuinely legacy unanchored attachment
 * from an asset that must not be resurrected after a failed physical delete.
 */
export function encodeReplicaRetiredAttachment(
  retired: ReplicaRetiredAttachment,
): EditorSurfaceBlock {
  return {
    id: retired.id,
    kind: REPLICA_RETIRED_ATTACHMENT_KIND,
    data: {
      attachmentId: retired.attachmentId.slice(0, MAX_REPLICA_RETIRED_ATTACHMENT_ID),
    },
  }
}

export function decodeReplicaRetiredAttachment(
  block: EditorSurfaceBlock,
): ReplicaRetiredAttachment | null {
  if (block.kind !== REPLICA_RETIRED_ATTACHMENT_KIND) return null

  const attachmentId = readString(block.data.attachmentId)
  if (!attachmentId) return null

  return {
    id: block.id,
    kind: REPLICA_RETIRED_ATTACHMENT_KIND,
    attachmentId: attachmentId.slice(0, MAX_REPLICA_RETIRED_ATTACHMENT_ID),
  }
}

export function createReplicaRetiredAttachment(
  attachmentId: string,
): ReplicaRetiredAttachment {
  return {
    id: `attachment-retired-${crypto.randomUUID()}`,
    kind: REPLICA_RETIRED_ATTACHMENT_KIND,
    attachmentId: attachmentId.slice(0, MAX_REPLICA_RETIRED_ATTACHMENT_ID),
  }
}
