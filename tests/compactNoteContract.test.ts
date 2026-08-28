import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const compactContract = readFileSync('src/features/notes/compactNoteContract.css', 'utf8')
const feedbackRuntime = readFileSync('src/features/folders/FolderOperationFeedbackRuntime.tsx', 'utf8')
const feedbackCss = readFileSync('src/features/folders/folderOperationFeedback.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')

test('compact note rows reserve separate icon, text and metadata zones', () => {
  assert.match(compactContract, /padding:\s*12px clamp\(160px, 44vw, 230px\) 10px 64px !important/)
  assert.match(compactContract, /max-width:\s*min\(30vw, 180px\) !important/)
  assert.match(compactContract, /place-items:\s*center !important/)
  assert.match(compactContract, /transform:\s*translateY\(-1px\) !important/)
  assert.ok(!main.includes("features/notes/compactNoteContract.css"))
  assert.ok(visualRuntime.includes("import './compactNoteContract.css'"))
  assert.ok(!main.includes('compactNotePolish.css'))
})

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
