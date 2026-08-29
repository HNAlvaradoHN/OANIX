import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const feedbackRuntime = readFileSync('src/features/folders/FolderOperationFeedbackRuntime.tsx', 'utf8')
const feedbackCss = readFileSync('src/features/folders/folderOperationFeedback.css', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')

test('folder customization stays quiet during appearance preview and confirms only the real save', () => {
  assert.doesNotMatch(feedbackRuntime, /Vista previa aplicada/)
  assert.doesNotMatch(feedbackRuntime, /pendingSelection/)
  assert.doesNotMatch(feedbackRuntime, /restoreFolderIcon/)
  assert.match(feedbackRuntime, /Procesando y cifrando imagen/)
  assert.match(feedbackRuntime, /oanix:folder-appearance-saved/)
  assert.match(feedbackRuntime, /✓ Guardado/)
  assert.doesNotMatch(feedbackRuntime, /collapseAppearancePicker/)
  assert.doesNotMatch(feedbackRuntime, /✓ Color guardado|✓ Icono guardado/)
  assert.match(feedbackCss, /data-oanix-operation-state='busy'/)
  assert.match(feedbackCss, /\.oanix-folder-customizer__actions\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important/)
  assert.ok(legacyGate.includes('<FolderOperationFeedbackRuntime />'))
})
