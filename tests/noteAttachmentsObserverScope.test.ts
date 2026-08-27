import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/attachments/NoteAttachmentsRuntime.tsx', 'utf8')

test('attachments observer filters workspace mutations before refreshing targets', () => {
  assert.match(runtime, /mutationTouchesAttachmentTargets/)
  assert.match(runtime, /records\.some\(mutationTouchesAttachmentTargets\)/)
  assert.match(runtime, /attributeFilter:\s*\['class'\]/)
  assert.match(runtime, /attributeOldValue:\s*true/)
  assert.match(runtime, /note-row--selected/)
  assert.match(runtime, /image-note-editor-root/)
  assert.match(runtime, /editor-toolbar/)
  assert.match(runtime, /editor-command-grid--insert/)
  assert.doesNotMatch(runtime, /new MutationObserver\(refresh\)/)
})
