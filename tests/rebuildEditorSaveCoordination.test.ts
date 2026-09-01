import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const rebuild = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')

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

test('plain text surface still does not receive rich block callbacks from the app', () => {
  assert.match(rebuild, /<EditorSurface[\s\S]*onRequestSave=\{saveEditorSnapshot\}[\s\S]*onRequestClose=\{closeEditor\}/)
  assert.doesNotMatch(rebuild, /loadBlocks=|onRequestBlockSave=/)
})
