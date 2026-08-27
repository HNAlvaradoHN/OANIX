import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')

test('organic workspace ignores unrelated note-list churn before decorating workspace', () => {
  assert.match(runtime, /querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(runtime, /mutationTouchesOrganicWorkspaceTargets/)
  assert.match(runtime, /records\.some\(mutationTouchesOrganicWorkspaceTargets\)/)
  assert.match(runtime, /notes-sidebar/)
  assert.match(runtime, /notes-list/)
  assert.match(runtime, /oanix-folder-rail__item/)
  assert.match(runtime, /tag-filter-button/)
  assert.match(runtime, /attributeFilter:\s*\['class',\s*'aria-current'\]/)
  assert.doesNotMatch(runtime, /new MutationObserver\(\(\) => \{/)
})
