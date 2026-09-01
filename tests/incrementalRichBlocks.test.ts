import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const model = readFileSync('src/features/rebuild/rebuildModel.ts', 'utf8')
const mutations = readFileSync('src/features/rebuild/incrementalNoteBlocks.ts', 'utf8')
const service = readFileSync('src/features/rebuild/rebuildBlockService.ts', 'utf8')

test('rich blocks use additive encrypted v2 record types without a database migration', () => {
  assert.match(model, /NOTE_V2_BLOCK_MANIFEST_TYPE = 'note\.v2\.block-manifest'/)
  assert.match(model, /NOTE_V2_BLOCK_TYPE = 'note\.v2\.block'/)
  assert.match(model, /format: 'blocks-v1'/)
  assert.match(model, /blockIds: string\[\]/)
  assert.doesNotMatch(model, /NoteV2BlockManifest[\s\S]*data:/)
})

test('block payloads are JSON-safe opaque data instead of template-specific storage', () => {
  assert.match(model, /export type NoteV2BlockValue/)
  assert.match(model, /kind: string/)
  assert.match(model, /data: \{ \[key: string\]: NoteV2BlockValue \}/)
  assert.doesNotMatch(model, /qwen|appquen|Aurora|ruledSheet/i)
  assert.doesNotMatch(service, /qwen|appquen|Aurora|ruledSheet/i)
})

test('single-block edits only inspect affected ids and skip unchanged encrypted writes', () => {
  assert.match(service, /const affectedIds = Array\.from\(new Set\(/)
  assert.match(service, /affectedIds\.map\(\(blockId\) => blockIdentity\(noteId, blockId\)\)/)
  assert.doesNotMatch(service, /listEncryptedV2Records/)
  assert.match(mutations, /if \(existing && blockEquals\(existing, draft\)\) continue/)
  assert.match(service, /if \(!mutation\.changed\) return manifest/)
  assert.match(service, /applyEncryptedV2Changes\(\{ writes: mutation\.writes, deletes: mutation\.deletes \}\)/)
})

test('block ordering is independent so payload edits do not rewrite the manifest', () => {
  assert.match(mutations, /const topologyChanged = !sameOrder\(existingOrder, nextOrder\)/)
  assert.match(mutations, /if \(topologyChanged\) \{/)
  assert.match(mutations, /recordType: NOTE_V2_BLOCK_MANIFEST_TYPE/)
  assert.match(mutations, /newlyAddedIds/)
  assert.match(mutations, /realDeletedIds/)
})

test('rich block changes join the existing encrypted sync pending queue', () => {
  assert.match(mutations, /createPendingSyncWrite\(noteId, NOTE_V2_BLOCK_TYPE/)
  assert.match(mutations, /NOTE_V2_BLOCK_MANIFEST_TYPE/)
  assert.match(mutations, /'delete'/)
  assert.doesNotMatch(mutations, /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest/)
})

test('block service can read ordered blocks and rejects incomplete encrypted notes', () => {
  assert.match(service, /export async function readRebuildBlocks/)
  assert.match(service, /manifest\.blockIds\.map\(\(blockId\) => blockIdentity\(noteId, blockId\)\)/)
  assert.match(service, /referencia a un bloque inexistente/)
  assert.match(service, /validateBlockRecord/)
})
