import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const compactPolish = readFileSync('src/features/notes/compactNotePolish.css', 'utf8')
const feedbackRuntime = readFileSync('src/features/folders/FolderOperationFeedbackRuntime.tsx', 'utf8')
const feedbackCss = readFileSync('src/features/folders/folderOperationFeedback.css', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')

test('compact note rows reserve separate icon, text and metadata zones', () => {
  assert.match(compactPolish, /padding-left:\s*64px !important/)
  assert.match(compactPolish, /padding-right:\s*clamp\(160px, 44vw, 230px\) !important/)
  assert.match(compactPolish, /max-width:\s*min\(30vw, 180px\) !important/)
  assert.match(compactPolish, /place-items:\s*center !important/)
  assert.match(compactPolish, /transform:\s*translateY\(-1px\) !important/)
  assert.ok(main.includes("import './features/notes/compactNotePolish.css'"))
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
