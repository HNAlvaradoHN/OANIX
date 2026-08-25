import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const folderFeedback = readFileSync('src/features/folders/FolderOperationFeedbackRuntime.tsx', 'utf8')
const attachments = readFileSync('src/features/attachments/NoteAttachmentsRuntime.tsx', 'utf8')

test('folder operation feedback observes deeply only inside the customizer portal', () => {
  assert.match(folderFeedback, /modalObserver\.observe\(observedModal,\s*\{[\s\S]*subtree:\s*true/)
  assert.match(folderFeedback, /portalObserver\.observe\(document\.body,\s*\{\s*childList:\s*true\s*\}\)/)
  assert.doesNotMatch(folderFeedback, /observe\(document\.body,\s*\{[\s\S]*subtree:\s*true/)
})

test('note attachments observes only the notes workspace', () => {
  assert.match(attachments, /querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(attachments, /observer\.observe\(workspace,\s*\{[\s\S]*subtree:\s*true/)
  assert.doesNotMatch(attachments, /observer\.observe\(document\.body/)
})
