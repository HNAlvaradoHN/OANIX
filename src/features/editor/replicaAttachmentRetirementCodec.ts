import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const REPLICA_ATTACHMENT_RETIREMENT_KIND = 'replica-attachment-retirement-v1'
export const MAX_REPLICA_RETIRED_ATTACHMENT_ID = 180

export interface ReplicaAttachmentRetirement {
  id: string
  kind: typeof REPLICA_ATTACHMENT_RETIREMENT_KIND
  attachmentId: string
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Hidden cleanup marker for an attachment that was intentionally removed from
 * the visual flow but whose encrypted asset could not be deleted yet.
 *
 * This prevents legacy flow migration from resurrecting that old asset on the
 * next open. It stores only the opaque attachment id; bytes/storage/provider
 * metadata remain exclusively in the attachment subsystem.
 */
export function encodeReplicaAttachmentRetirement(
  retirement: ReplicaAttachmentRetirement,
): EditorSurfaceBlock {
  return {
    id: retirement.id,
    kind: REPLICA_ATTACHMENT_RETIREMENT_KIND,
    data: {
      attachmentId: retirement.attachmentId.slice(0, MAX_REPLICA_RETIRED_ATTACHMENT_ID),
    },
  }
}

export function decodeReplicaAttachmentRetirement(
  block: EditorSurfaceBlock,
): ReplicaAttachmentRetirement | null {
  if (block.kind !== REPLICA_ATTACHMENT_RETIREMENT_KIND) return null
  const attachmentId = readString(block.data.attachmentId)
  if (!attachmentId) return null

  return {
    id: block.id,
    kind: REPLICA_ATTACHMENT_RETIREMENT_KIND,
    attachmentId: attachmentId.slice(0, MAX_REPLICA_RETIRED_ATTACHMENT_ID),
  }
}

export function createReplicaAttachmentRetirement(
  attachmentId: string,
): ReplicaAttachmentRetirement {
  return {
    id: `attachment-retirement-${crypto.randomUUID()}`,
    kind: REPLICA_ATTACHMENT_RETIREMENT_KIND,
    attachmentId: attachmentId.slice(0, MAX_REPLICA_RETIRED_ATTACHMENT_ID),
  }
}
