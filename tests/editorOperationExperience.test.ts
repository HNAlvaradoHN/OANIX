import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/EditorOperationRuntime.tsx', 'utf8')
const polish = readFileSync('src/features/editor/editorOperationPolish.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('large code paste yields a paint before syncing the complete note model', () => {
  assert.match(runtime, /isHeavyCodePaste/)
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/)
  assert.match(runtime, /insertPlainText\(codeContent, plainText, range\)/)
  assert.match(runtime, /requestAnimationFrame/)
  assert.match(runtime, /codeContent\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/)
  assert.doesNotMatch(runtime, /execCommand/)
  assert.match(runtime, /Pegando código…/)
})

test('image insertion exposes blocking processing feedback until the image block appears', () => {
  assert.match(runtime, /Procesando y cifrando imagen…/)
  assert.match(runtime, /watchImageOperation/)
  assert.match(runtime, /data-image-block/)
  assert.match(runtime, /MutationObserver/)
})

test('mobile note canvas keeps breathing room and constrains inline code height', () => {
  assert.match(polish, /\.notes-shell--open \.note-canvas[\s\S]*padding-bottom:/)
  assert.match(polish, /\.editor-code-block__content[\s\S]*max-height: clamp\(10rem, 30dvh, 15rem\) !important/)
  assert.match(polish, /overflow-y: auto !important/)
})

test('note deletion feedback blocks interaction behind the delete operation', () => {
  assert.match(polish, /#oanix-note-delete-feedback[\s\S]*pointer-events: auto !important/)
  assert.match(polish, /#oanix-note-delete-feedback[\s\S]*height: 100dvh !important/)
})

test('editor operation runtime only mounts after the workspace gate opens', () => {
  assert.match(gate, /import \{ EditorOperationRuntime \}/)
  const activeGuard = gate.indexOf('if (!active) return null')
  const runtimeMount = gate.indexOf('<EditorOperationRuntime />')
  assert.ok(activeGuard >= 0 && runtimeMount > activeGuard)
})
