import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const compactContract = readFileSync('src/features/notes/compactNoteContract.css', 'utf8')
const feedbackRuntime = readFileSync('src/features/folders/FolderOperationFeedbackRuntime.tsx', 'utf8')
const feedbackCss = readFileSync('src/features/folders/folderOperationFeedback.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')

test('compact note rows reserve separate icon, text and metadata zones', () => {
  assert.match(compactContract, /padding-left:\s*64px !important/)
  assert.match(compactContract, /padding-right:\s*clamp\(160px, 44vw, 230px\) !important/)
  assert.match(compactContract, /max-width:\s*min\(30vw, 180px\) !important/)
  assert.match(compactContract, /place-items:\s*center !important/)
  assert.match(compactContract, /transform:\s*translateY\(-1px\) !important/)
  assert.ok(main.includes("import './features/notes/compactNoteContract.css'"))
  assert.ok(!main.includes('compactNotePolish.css'))
})

test('folder customization shows progress and closes the icon picker after confirmation', () => {
  assert.match(feedbackRuntime, /Guardando icono/)
  assert.match(feedbackRuntime, /Procesando y cifrando imagen/)
  assert.match(feedbackRuntime, /previewFolderIcon/)
  assert.match(feedbackRuntime, /collapseAppearancePicker/)
  assert.match(feedbackRuntime, /button\.dataset\.selected === 'true'/)
  assert.match(feedbackCss, /data-oanix-operation-state='busy'/)
  assert.ok(gate.includes('<FolderOperationFeedbackRuntime />'))
})
