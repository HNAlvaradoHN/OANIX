import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/EditorOperationRuntime.tsx', 'utf8')
const polish = readFileSync('src/features/editor/editorOperationPolish.css', 'utf8')
const trailing = readFileSync('src/features/editor/editorTrailingWorkspace.css', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
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

test('mobile note canvas keeps one runway authority and constrains inline code height', () => {
  assert.doesNotMatch(polish, /\.notes-shell--open \.note-canvas/)
  assert.match(trailing, /\.notes-shell--open \.note-canvas[\s\S]*padding-bottom:/)
  assert.match(trailing, /\.editor-code-block__content[\s\S]*max-height: clamp\(10rem, 30dvh, 15rem\) !important/)
  assert.match(trailing, /overflow-y: auto !important/)
})

test('note deletion feedback blocks interaction behind the delete operation', () => {
  assert.match(polish, /#oanix-note-delete-feedback[\s\S]*pointer-events: auto !important/)
  assert.match(polish, /#oanix-note-delete-feedback[\s\S]*height: 100dvh !important/)
})

test('editor operation runtime mounts with the unlocked app lifecycle', () => {
  assert.match(app, /<WorkspaceRuntimeGate workspaceRevision=\{workspaceRevision\} \/>/)
  assert.match(gate, /import \{ EditorOperationRuntime \}/)
  assert.match(gate, /<EditorOperationRuntime \/>/)
  assert.doesNotMatch(gate, /if \(!active\) return null/)
})

test('reduced motion makes editor and delete feedback static instead of endlessly animated', () => {
  assert.match(polish, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(
    polish,
    /\.oanix-editor-operation-feedback__spinner,[\s\S]*#oanix-note-delete-feedback > span:first-child[\s\S]*animation: none;/,
  )
  assert.doesNotMatch(polish, /prefers-reduced-motion:[\s\S]*animation-duration: 1\.8s/)
})
