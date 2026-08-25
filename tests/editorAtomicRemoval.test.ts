import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/EditorOperationRuntime.tsx', 'utf8')
const operationCss = readFileSync('src/features/editor/editorOperationPolish.css', 'utf8')
const runwayCss = readFileSync('src/features/editor/editorTrailingWorkspace.css', 'utf8')

test('checklists keep explicit removal while daily entry deletion stays out of the normal UI', () => {
  assert.match(runtime, /button\.dataset\.atomicBlockRemove = kind/)
  assert.match(runtime, /Eliminar checklist/)
  assert.match(runtime, /Eliminar entrada/)
  assert.match(runtime, /window\.confirm\(question\)/)
  assert.match(operationCss, /\.editor-atomic-block__remove/)
  assert.match(operationCss, /\.editor-daily-entry > \.editor-atomic-block__remove \{\s*display: none !important;/)
})

test('removing a protected daily entry uses the existing protected-block authorization path', () => {
  assert.match(runtime, /editor\.dataset\.oanixAuthorizedProtectedRemoval = blockId/)
  assert.match(runtime, /editor\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/)
})

test('atomic block decoration watches only inserted app-root nodes and does not observe attribute churn', () => {
  assert.match(runtime, /const appRoot = document\.getElementById\('root'\)/)
  assert.match(runtime, /new MutationObserver/)
  assert.match(runtime, /mutation\.addedNodes/)
  assert.match(runtime, /atomicObserver\.observe\(appRoot, \{ childList: true, subtree: true \}\)/)
  assert.doesNotMatch(runtime, /atomicObserver\.observe\(document\.body/)
  assert.doesNotMatch(runtime, /atomicObserver\.observe[^\n]*attributes/)
})

test('mobile editing runway stays physically large without forcing focus to the bottom', () => {
  assert.match(runwayCss, /height: max\(36rem, 110dvh\)/)
  assert.match(runwayCss, /\.notes-shell--open > \.note-view[\s\S]*overflow-y: auto !important/)
  assert.match(runwayCss, /scroll-padding-bottom: calc\(7rem \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(runwayCss, /scroll-margin-bottom: calc\(7rem \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(runwayCss, /overflow-anchor: none/)
  assert.doesNotMatch(runwayCss, /scroll-padding-bottom: max\(36rem, 110dvh\)/)
  assert.doesNotMatch(runwayCss, /scroll-margin-bottom: max\(28rem, 82dvh\)/)
  assert.doesNotMatch(operationCss, /notes-shell--open \.note-canvas/)
  assert.doesNotMatch(operationCss, /image-note-editor-root \.editor-surface/)
})
