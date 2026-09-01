import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const checklist = readFileSync('src/features/editor/implementations/QwenChecklistBlocks.tsx', 'utf8')
const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')

test('checklist UI stays above persistence and uses the generic block session', () => {
  assert.match(checklist, /decodeChecklistBlock/)
  assert.match(checklist, /encodeChecklistBlock/)
  assert.match(checklist, /session\.load\(\)/)
  assert.match(checklist, /session\.upsert\(encodeChecklistBlock\(next\)\)/)
  assert.match(checklist, /session\.remove\(blockId\)/)
  assert.doesNotMatch(
    checklist,
    /readRebuildBlocks|saveRebuildBlocks|indexedDB|localStorage|sessionStorage|applyEncrypted|fetch\(|XMLHttpRequest/,
  )
})

test('checklist supports create, edit, toggle, add item and delete interactions', () => {
  assert.match(checklist, /function addChecklist\(\)/)
  assert.match(checklist, /function addItem\(block: EditorChecklistBlock\)/)
  assert.match(checklist, /function removeItem\(block: EditorChecklistBlock, itemIndex: number\)/)
  assert.match(checklist, /onChange=\{\(event\) => queueBlock\(withItem\(/)
  assert.match(checklist, /checked: event\.target\.checked/)
  assert.match(checklist, /text: event\.target\.value/)
  assert.match(checklist, /removeChecklist\(block\.id\)/)
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
  assert.match(surface, /<QwenChecklistBlocks/)
  assert.match(surface, /onActivity=\{markActivity\}/)
})
