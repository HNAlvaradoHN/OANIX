import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')

test('organic workspace observes the notes shell instead of the whole document body', () => {
  assert.match(organic, /querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(organic, /observer\.observe\(workspace,\s*\{[\s\S]*subtree:\s*true/)
  assert.doesNotMatch(organic, /observer\.observe\(document\.body,\s*\{[\s\S]*subtree:\s*true/)
})

test('workspace personalization scopes observation to notes shell and keeps the customizer portal observer-free', () => {
  assert.match(personalization, /workspaceStructureObserver\.observe\(workspace,\s*\{[\s\S]*subtree:\s*true/)
  assert.match(personalization, /workspaceStateObserver\.observe\(workspace,\s*\{[\s\S]*attributeFilter:\s*\['class'\]/)
  assert.doesNotMatch(personalization, /workspaceStateObserver\.observe\(workspace,\s*\{[\s\S]*subtree:\s*true/)
  assert.doesNotMatch(personalization, /portalObserver/)
  assert.doesNotMatch(personalization, /observe\(document\.body/)
  assert.match(personalization, /createPortal\([\s\S]*document\.body/)
})
