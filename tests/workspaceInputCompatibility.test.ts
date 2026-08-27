import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/WorkspaceInputCompatibilityRuntime.tsx', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('el runtime global ya no compite por el estado de Sortable de notas', () => {
  assert.doesNotMatch(runtime, /sortablejs|sortableApi|sortable\.option|NOTE_LIST_SELECTOR/)
  assert.doesNotMatch(runtime, /pointerdown|pointerType/)
})

test('los botones visibles de carpetas abren el creador por evento directo', () => {
  assert.match(runtime, /\.oanix-organic-folder-control--add/)
  assert.match(runtime, /\.oanix-folder-rail__item--add/)
  assert.match(runtime, /\.notes-tab--add/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
  assert.match(runtime, /oanix:open-folder-creator/)
  assert.doesNotMatch(runtime, /managerButton\.click\(\)/)
})

test('el runtime de compatibilidad deja la persistencia del drag al runtime de carpetas', () => {
  assert.doesNotMatch(runtime, /persistFolderOrder/)
  assert.doesNotMatch(runtime, /visibleFolderOrder/)
  assert.doesNotMatch(runtime, /persistDesktopFolderDrop/)
})

test('el runtime de compatibilidad solo monta dentro del workspace desbloqueado', () => {
  assert.doesNotMatch(main, /WorkspaceInputCompatibilityRuntime/)
  assert.match(gate, /WorkspaceInputCompatibilityRuntime/)
  assert.match(gate, /<WorkspaceInputCompatibilityRuntime \/>/)
})
