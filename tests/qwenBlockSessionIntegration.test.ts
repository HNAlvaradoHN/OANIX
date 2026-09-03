import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const session = readFileSync('src/features/editor/editorBlockSession.ts', 'utf8')
const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
const host = readFileSync('src/features/editor/EditorSurface.tsx', 'utf8')
const activeSheet = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')

test('preserved Qwen sheet creates a block session only when both rich callbacks are available', () => {
  assert.match(surface, /loadBlocks,[\s\S]*onRequestBlockSave,/)
  assert.match(
    surface,
    /blockSessionRef\.current === null[\s\S]*&& loadBlocks[\s\S]*&& onRequestBlockSave[\s\S]*createEditorBlockSession\(/,
  )
  assert.doesNotMatch(surface, /readRebuildBlocks|saveRebuildBlocks|indexedDB|localStorage|sessionStorage/)
})

test('preserved Qwen safe close flushes accepted rich block work before delegating note close', () => {
  const closeStart = surface.indexOf('async function requestClose')
  const blockFlush = surface.indexOf('await blockSession.flush()', closeStart)
  const appClose = surface.indexOf('onRequestClose(', closeStart)

  assert.ok(closeStart >= 0)
  assert.ok(blockFlush > closeStart)
  assert.ok(appClose > blockFlush)
  assert.match(surface.slice(closeStart), /if \(blockSession && !\(await blockSession\.flush\(\)\)\) return/)
})

test('block session owns buffering only and receives persistence as callbacks', () => {
  assert.match(session, /createEditorBlockChangeBuffer/)
  assert.match(session, /loadBlocks: \(\) => Promise<EditorSurfaceBlock\[]>/)
  assert.match(session, /saveChanges: \(changes: EditorSurfaceBlockChangeSet\) => Promise<boolean>/)
  assert.doesNotMatch(
    session,
    /^\s*import .*from ['"][^'"]*(?:rebuild|storage|security|sync)[^'"]*['"]/im,
  )
  assert.doesNotMatch(session, /indexedDB|localStorage|sessionStorage|fetch\(|XMLHttpRequest|setTimeout|setInterval/)
})

test('active mixed phase enables generic rich callbacks without coupling the OANIX sheet to Qwen', () => {
  assert.match(registry, /richBlocks: true/)
  assert.match(
    host,
    /activeEditorSurface\.capabilities\.richBlocks[\s\S]*\? props[\s\S]*loadBlocks: undefined[\s\S]*onRequestBlockSave: undefined/,
  )
  assert.match(activeSheet, /loadBlocks/)
  assert.match(activeSheet, /onRequestBlockSave/)
  assert.doesNotMatch(activeSheet, /QwenSheetSurface|QwenRichBlocks|createEditorBlockSession/)
})
