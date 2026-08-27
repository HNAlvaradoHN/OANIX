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

test('folder operation feedback ignores unrelated body portal mutations', () => {
  assert.match(folderFeedback, /const FOLDER_CUSTOMIZER_SELECTOR = '\.oanix-folder-customizer'/)
  assert.match(folderFeedback, /function mutationTouchesFolderCustomizer\(record: MutationRecord\)/)
  assert.match(folderFeedback, /node\.matches\(FOLDER_CUSTOMIZER_SELECTOR\) \|\| node\.querySelector\(FOLDER_CUSTOMIZER_SELECTOR\) !== null/)
  assert.match(folderFeedback, /records\.some\(mutationTouchesFolderCustomizer\)/)
})

test('folder operation feedback scopes interaction listeners to the open customizer', () => {
  assert.match(folderFeedback, /observedModal\.addEventListener\('click', handleClickCapture, true\)/)
  assert.match(folderFeedback, /observedModal\.addEventListener\('change', handleChangeCapture, true\)/)
  assert.match(folderFeedback, /observedModal\?\.removeEventListener\('click', handleClickCapture, true\)/)
  assert.match(folderFeedback, /observedModal\?\.removeEventListener\('change', handleChangeCapture, true\)/)
  assert.doesNotMatch(folderFeedback, /document\.addEventListener\('click', handleClickCapture, true\)/)
  assert.doesNotMatch(folderFeedback, /document\.addEventListener\('change', handleChangeCapture, true\)/)
})

test('note attachments observes only the notes workspace', () => {
  assert.match(attachments, /querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(attachments, /observer\.observe\(workspace,\s*\{[\s\S]*subtree:\s*true/)
  assert.doesNotMatch(attachments, /observer\.observe\(document\.body/)
})

test('note attachments refresh only when attachment targets can change', () => {
  assert.match(attachments, /const ATTACHMENT_TARGET_SELECTOR = \[/)
  assert.match(attachments, /function mutationTouchesAttachmentTargets\(record: MutationRecord\)/)
  assert.match(attachments, /record\.addedNodes, \.\.\.record\.removedNodes/)
  assert.match(attachments, /record\.oldValue \?\? ''/)
  assert.match(attachments, /records\.some\(mutationTouchesAttachmentTargets\)/)
  assert.match(attachments, /attributeOldValue:\s*true/)
})
