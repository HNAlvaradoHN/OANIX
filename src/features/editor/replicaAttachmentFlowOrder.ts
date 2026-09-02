import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'
import { REPLICA_ATTACHMENT_PRESENTATION_KIND } from './replicaAttachmentPresentationCodec.ts'
import { REPLICA_ATTACHMENT_RETIREMENT_KIND } from './replicaAttachmentRetirementCodec.ts'

export interface ReplicaEditorBlockSplit {
  flowBlocks: EditorSurfaceBlock[]
  metadataBlocks: EditorSurfaceBlock[]
}

function isReplicaMetadataBlock(block: EditorSurfaceBlock): boolean {
  return block.kind === REPLICA_ATTACHMENT_PRESENTATION_KIND
    || block.kind === REPLICA_ATTACHMENT_RETIREMENT_KIND
}

/**
 * Replica attachment metadata is durable but not part of the visual/editor order.
 * Keep one shared definition so attachment anchors and normal rich blocks count
 * the same positions even if an older note has metadata interleaved in storage.
 */
export function splitReplicaEditorBlocks(
  blocks: readonly EditorSurfaceBlock[],
): ReplicaEditorBlockSplit {
  const flowBlocks: EditorSurfaceBlock[] = []
  const metadataBlocks: EditorSurfaceBlock[] = []

  for (const block of blocks) {
    if (isReplicaMetadataBlock(block)) metadataBlocks.push(block)
    else flowBlocks.push(block)
  }

  return { flowBlocks, metadataBlocks }
}

/**
 * Translate a visual flow position to the raw EditorBlockSession order.
 *
 * Hidden metadata records never consume a visual position. Insertion at the end
 * is placed immediately after the last visible block, before trailing hidden
 * metadata, so newly inserted blocks do not drift behind metadata records.
 */
export function replicaFlowIndexToOrderIndex(
  blocks: readonly EditorSurfaceBlock[],
  flowIndex: number,
): number {
  const { flowBlocks } = splitReplicaEditorBlocks(blocks)
  if (!Number.isInteger(flowIndex) || flowIndex < 0 || flowIndex > flowBlocks.length) {
    throw new Error('Replica flow insertion index is outside the visible block order.')
  }

  if (flowIndex < flowBlocks.length) {
    const targetId = flowBlocks[flowIndex].id
    const rawIndex = blocks.findIndex((block) => block.id === targetId)
    if (rawIndex >= 0) return rawIndex
  }

  for (let rawIndex = blocks.length - 1; rawIndex >= 0; rawIndex -= 1) {
    if (!isReplicaMetadataBlock(blocks[rawIndex])) return rawIndex + 1
  }

  return 0
}
