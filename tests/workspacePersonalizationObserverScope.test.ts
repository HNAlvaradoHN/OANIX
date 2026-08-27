import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')

test('workspace personalization scopes state observation to the shell itself', () => {
  assert.doesNotMatch(runtime, /portalObserver/)
  assert.doesNotMatch(runtime, /observe\(document\.body/)
  assert.match(runtime, /workspaceStructureObserver\.observe\(workspace, \{\s*childList: true,\s*subtree: true,\s*\}\)/)
  assert.match(runtime, /workspaceStateObserver\.observe\(workspace, \{\s*attributes: true,\s*attributeFilter: \['class'\],\s*\}\)/)
  assert.doesNotMatch(runtime, /attributeFilter:\s*\['class', 'aria-current'\]/)
  assert.doesNotMatch(runtime, /attributes: true,\s*attributeFilter: \['class'\],\s*subtree: true/)
  assert.match(runtime, /workspaceStructureObserver\.disconnect\(\)/)
  assert.match(runtime, /workspaceStateObserver\.disconnect\(\)/)
})
