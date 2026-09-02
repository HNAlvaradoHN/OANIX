import assert from 'node:assert/strict'
import test from 'node:test'
import type { EditorSurfaceBlock } from '../src/features/editor/editorSurfaceContract.ts'
import { REPLICA_ATTACHMENT_PRESENTATION_KIND } from '../src/features/editor/replicaAttachmentPresentationCodec.ts'
import { REPLICA_ATTACHMENT_RETIREMENT_KIND } from '../src/features/editor/replicaAttachmentRetirementCodec.ts'
import {
  replicaFlowIndexToOrderIndex,
  splitReplicaEditorBlocks,
} from '../src/features/editor/replicaAttachmentFlowOrder.ts'

function block(id: string, kind = 'text-v1'): EditorSurfaceBlock {
  return { id, kind, data: {} }
}

test('replica flow split keeps attachment metadata out of visual order', () => {
  const blocks = [
    block('a'),
    block('meta-a', REPLICA_ATTACHMENT_PRESENTATION_KIND),
    block('retired-a', REPLICA_ATTACHMENT_RETIREMENT_KIND),
    block('b'),
    block('meta-b', REPLICA_ATTACHMENT_PRESENTATION_KIND),
  ]
  const split = splitReplicaEditorBlocks(blocks)
  assert.deepEqual(split.flowBlocks.map((item) => item.id), ['a', 'b'])
  assert.deepEqual(split.metadataBlocks.map((item) => item.id), ['meta-a', 'retired-a', 'meta-b'])
})

test('replica flow insertion translates contextual positions across hidden metadata', () => {
  const blocks = [
    block('a'),
    block('meta-a', REPLICA_ATTACHMENT_PRESENTATION_KIND),
    block('retired-a', REPLICA_ATTACHMENT_RETIREMENT_KIND),
    block('b'),
    block('meta-b', REPLICA_ATTACHMENT_PRESENTATION_KIND),
  ]
  assert.equal(replicaFlowIndexToOrderIndex(blocks, 0), 0)
  assert.equal(replicaFlowIndexToOrderIndex(blocks, 1), 3)
  assert.equal(replicaFlowIndexToOrderIndex(blocks, 2), 4)
})

test('replica flow insertion at end stays before trailing attachment metadata', () => {
  const blocks = [
    block('a'),
    block('b'),
    block('meta-a', REPLICA_ATTACHMENT_PRESENTATION_KIND),
    block('retired-a', REPLICA_ATTACHMENT_RETIREMENT_KIND),
  ]
  assert.equal(replicaFlowIndexToOrderIndex(blocks, 2), 2)
})

test('replica flow insertion rejects invalid visual indices', () => {
  assert.throws(() => replicaFlowIndexToOrderIndex([block('a')], -1))
  assert.throws(() => replicaFlowIndexToOrderIndex([block('a')], 2))
})
