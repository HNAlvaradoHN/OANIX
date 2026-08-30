import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/AuroraDestructiveActionConfirmationRuntime.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('Aurora confirms code-block conversion before shared editor persistence', () => {
  assert.match(gate, /AuroraDestructiveActionConfirmationRuntime/)
  assert.match(runtime, /data-note-sheet-theme=\\"aurora\\"/)
  assert.match(runtime, /data-code-convert=\\"true\\"/)
  assert.match(runtime, /data-format=\\"code\\"/)
  assert.match(runtime, /aria-pressed/)
  assert.match(runtime, /window\.confirm\(CODE_CONVERSION_CONFIRMATION\)/)
  assert.match(runtime, /event\.preventDefault\(\)/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
})
