import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const rebuild = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')

test('rebuild editor keeps one save coordinator per mounted app runtime', () => {
  assert.match(rebuild, /createEditorSaveCoordinator/)
  assert.match(rebuild, /useRef<EditorSaveCoordinator \| null>\(null\)/)
  assert.match(rebuild, /editorSaveCoordinatorRef\.current === null[\s\S]*createEditorSaveCoordinator\(\)/)
  assert.doesNotMatch(rebuild, /saveEditorSnapshot[\s\S]*createEditorSaveCoordinator\(\)/)
  assert.doesNotMatch(rebuild, /closeEditor[\s\S]*createEditorSaveCoordinator\(\)/)
})

test('autosave reads the latest editor revision only after entering the serialized lane', () => {
  assert.match(
    rebuild,
    /saveEditorSnapshot[\s\S]*editorSaveCoordinator\.run\(async \(\) => \{[\s\S]*const current = editorRef\.current[\s\S]*saveRebuildNote\(/,
  )
  assert.match(rebuild, /if \(!current \|\| blockingSaveRef\.current\) return false/)
})

test('safe close blocks new autosaves, drains queued work, then saves the final snapshot', () => {
  const closeStart = rebuild.indexOf('async function closeEditor')
  const blocking = rebuild.indexOf('blockingSaveRef.current = true', closeStart)
  const idle = rebuild.indexOf('await editorSaveCoordinator.idle()', closeStart)
  const finalRun = rebuild.indexOf('return await editorSaveCoordinator.run(async () => {', closeStart)
  const latestCurrent = rebuild.indexOf('const current = editorRef.current', finalRun)

  assert.ok(closeStart >= 0)
  assert.ok(blocking > closeStart)
  assert.ok(idle > blocking)
  assert.ok(finalRun > idle)
  assert.ok(latestCurrent > finalRun)
})

test('block reads are serialized and map storage records into the generic editor contract', () => {
  assert.match(
    rebuild,
    /loadEditorBlocks[\s\S]*editorSaveCoordinator\.run\(async \(\) => \{[\s\S]*readRebuildBlocks\(noteId\)[\s\S]*id: block\.blockId[\s\S]*kind: block\.kind[\s\S]*data: block\.data/,
  )
})

test('accepted block saves survive close draining and skip state churn on storage no-ops', () => {
  const saveStart = rebuild.indexOf('async function saveEditorBlocks')
  const runStart = rebuild.indexOf('editorSaveCoordinator.run(async () => {', saveStart)
  const closeStart = rebuild.indexOf('async function closeEditor', saveStart)
  const beforeRun = rebuild.slice(saveStart, runStart)
  const insideRun = rebuild.slice(runStart, closeStart)

  assert.match(beforeRun, /blockingSaveRef\.current/)
  assert.doesNotMatch(insideRun, /blockingSaveRef\.current/)
  assert.match(insideRun, /saveRebuildBlocks\(current\.meta/)
  assert.match(insideRun, /blockId: block\.id/)
  assert.match(insideRun, /if \(updated === current\.meta\) return true/)
})

test('application rich callbacks stay available at the app boundary but are gated off for the active sheet', () => {
  assert.match(rebuild, /loadBlocks=\{loadEditorBlocks\}/)
  assert.match(rebuild, /onRequestBlockSave=\{saveEditorBlocks\}/)
  assert.match(host, /activeEditorSurface\.capabilities\.richBlocks[\s\S]*loadBlocks: undefined[\s\S]*onRequestBlockSave: undefined/)
  assert.match(registry, /richBlocks: false/)
})
