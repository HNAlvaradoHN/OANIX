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

test('folder drag autoscroll targets the actual scroll viewport in both directions', () => {
  assert.match(drawer, /const foldersScrollRef = useRef<HTMLDivElement \| null>\(null\)/)
  assert.match(
    drawer,
    /<div ref=\{foldersScrollRef\} className="rebuild-drawer__list workspace-drawer__list">/,
  )
  assert.match(drawer, /scrollNode: HTMLElement = node/)
  assert.match(drawer, /scroll:\s*scrollNode/)
  assert.match(drawer, /scrollSensitivity:\s*72/)
  assert.match(drawer, /scrollSpeed:\s*14/)
  assert.match(drawer, /bubbleScroll:\s*false/)
  assert.match(
    drawer,
    /createSortable\([\s\S]*foldersNode,[\s\S]*'oanix-home-folders',[\s\S]*foldersScrollNode,[\s\S]*\)/,
  )
})
