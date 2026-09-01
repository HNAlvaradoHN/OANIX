import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const richBlocks = readFileSync('src/features/editor/implementations/QwenRichBlocks.tsx', 'utf8')
const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')

test('checklist UI stays above persistence and uses the generic block session', () => {
  assert.match(richBlocks, /decodeChecklistBlock/)
  assert.match(richBlocks, /encodeChecklistBlock/)
  assert.match(richBlocks, /session\.load\(\)/)
  assert.match(richBlocks, /session\.upsert\(next\)/)
  assert.match(richBlocks, /session\.remove\(blockId\)/)
  assert.doesNotMatch(
    richBlocks,
    /readRebuildBlocks|saveRebuildBlocks|indexedDB|localStorage|sessionStorage|applyEncrypted|fetch\(|XMLHttpRequest/,
  )
})

test('checklist supports create, edit, toggle, add item and delete interactions', () => {
  assert.match(richBlocks, /kind === 'checklist'/)
  assert.match(richBlocks, /MAX_CHECKLIST_ITEMS/)
  assert.match(richBlocks, /checked: event\.target\.checked/)
  assert.match(richBlocks, /text: event\.target\.value/)
  assert.match(richBlocks, /Eliminar checklist/)
  assert.match(richBlocks, />\+ Añadir tarea</)
})

test('block-only autosave skips the plain text write and flushes the shared block checkpoint', () => {
  const saveStart = surface.indexOf('async function saveCurrentSnapshot')
  const saveEnd = surface.indexOf('async function runAutosaveIfIdle', saveStart)
  const body = surface.slice(saveStart, saveEnd)

  assert.match(body, /const snapshotChanged = !snapshotsMatch\(snapshot, committedSnapshotRef\.current\)/)
  assert.match(body, /if \(snapshotChanged\) \{[\s\S]*textSaved = await onRequestSave\(snapshot\)/)
  assert.match(body, /blockSession\?\.hasPending\(\) && !\(await blockSession\.flush\(\)\)/)
  assert.ok(body.indexOf('if (snapshotChanged)') < body.indexOf('blockSession?.hasPending()'))
})

test('rich blocks are active while attachment transport remains disabled', () => {
  assert.match(registry, /richBlocks: true/)
  assert.match(registry, /attachments: false/)
  assert.match(surface, /<QwenRichBlocks/)
  assert.match(surface, /onActivity=\{markActivity\}/)
})
