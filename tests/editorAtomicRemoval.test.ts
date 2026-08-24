import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/editor/EditorOperationRuntime.tsx', 'utf8')
const operationCss = readFileSync('src/features/editor/editorOperationPolish.css', 'utf8')
const runwayCss = readFileSync('src/features/editor/editorTrailingWorkspace.css', 'utf8')

test('checklists and daily entries expose an explicit complete-block removal action', () => {
  assert.match(runtime, /button\.dataset\.atomicBlockRemove = kind/)
  assert.match(runtime, /Eliminar checklist/)
  assert.match(runtime, /Eliminar entrada/)
  assert.match(runtime, /\[data-checklist-block="true"\], \[data-daily-entry-block="true"\]/)
  assert.match(runtime, /window\.confirm\(question\)/)
  assert.match(operationCss, /\.editor-atomic-block__remove/)
})

test('removing a protected daily entry uses the existing protected-block authorization path', () => {
  assert.match(runtime, /editor\.dataset\.oanixAuthorizedProtectedRemoval = blockId/)
  assert.match(runtime, /editor\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/)
})

test('atomic block decoration watches only inserted DOM nodes and does not observe attribute churn', () => {
  assert.match(runtime, /new MutationObserver/)
  assert.match(runtime, /mutation\.addedNodes/)
  assert.match(runtime, /atomicObserver\.observe\(document\.body, \{ childList: true, subtree: true \}\)/)
  assert.doesNotMatch(runtime, /atomicObserver\.observe[^\n]*attributes/)
})

test('mobile editing runway has one CSS authority and survives keyboard viewport shrink', () => {
  assert.match(runwayCss, /height: max\(36rem, 110dvh\)/)
  assert.match(runwayCss, /\.notes-shell--open > \.note-view[\s\S]*scroll-padding-bottom: max\(36rem, 110dvh\)/)
  assert.match(runwayCss, /\.notes-shell--open > \.note-view[\s\S]*overflow-y: auto !important/)
  assert.doesNotMatch(operationCss, /notes-shell--open \.note-canvas/)
  assert.doesNotMatch(operationCss, /image-note-editor-root \.editor-surface/)
})
