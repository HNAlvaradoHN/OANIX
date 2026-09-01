import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const drawer = readFileSync('src/features/rebuild/WorkspaceDrawer.tsx', 'utf8')

test('workspace drawer skips persistence when a drag finishes in the same order', () => {
  assert.match(drawer, /function readOrderedIds\(node: HTMLElement\): string\[\]/)
  assert.match(drawer, /function ordersMatch\(left: string\[\], right: string\[\]\): boolean/)
  assert.match(drawer, /onStart:\s*\(\) => \{[\s\S]*orderBeforeDrag = readOrderedIds\(node\)/)
  assert.match(drawer, /if \(previousOrder && ordersMatch\(previousOrder, orderedIds\)\) return/)
  assert.match(drawer, /void onPersist\(orderedIds\)/)
})
