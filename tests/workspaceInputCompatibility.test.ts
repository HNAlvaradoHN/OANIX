import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/WorkspaceInputCompatibilityRuntime.tsx', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')

test('mouse reactiva el Sortable existente sin crear una segunda implementacion de drag', () => {
  assert.match(runtime, /sortableApi\.get\(list\)/)
  assert.match(runtime, /event\.pointerType === 'mouse'/)
  assert.match(runtime, /sortable\.option\('disabled', false\)/)
  assert.match(runtime, /event\.pointerType === 'touch'/)
  assert.match(runtime, /sortable\.option\('disabled', true\)/)
  assert.doesNotMatch(runtime, /Sortable\.create\(/)
})

test('el boton visible de carpetas abre directamente el administrador real', () => {
  assert.match(runtime, /\.oanix-organic-folder-control--add/)
  assert.match(runtime, /\.oanix-folder-rail__item--add/)
  assert.match(runtime, /\.notes-tab--add/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
  assert.match(runtime, /managerButton\.click\(\)/)
})

test('el runtime de compatibilidad queda montado globalmente', () => {
  assert.match(main, /WorkspaceInputCompatibilityRuntime/)
  assert.match(main, /<WorkspaceInputCompatibilityRuntime \/>/)
})
