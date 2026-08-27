import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')

test('workspace personalization avoids a global body MutationObserver', () => {
  assert.doesNotMatch(runtime, /portalObserver/)
  assert.doesNotMatch(runtime, /observe\(document\.body/)
  assert.match(runtime, /workspaceObserver\.observe\(workspace,[\s\S]*attributeFilter:\s*\['class', 'aria-current'\]/)
})
