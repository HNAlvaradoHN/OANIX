import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const drawer = readFileSync('src/features/rebuild/WorkspaceDrawer.tsx', 'utf8')
const css = readFileSync('src/features/rebuild/workspaceDrawer.css', 'utf8')

test('Home drawer remains a replaceable surface wired through callbacks', () => {
  assert.match(drawer, /interface WorkspaceDrawerProps/)
  assert.match(drawer, /onCreate: \(\) => void/)
  assert.match(drawer, /onCustomizeFolder: \(folderId: string\) => void/)
  assert.match(drawer, /onCustomizeTag: \(tagId: string\) => void/)
  assert.match(drawer, /onReorderFolders: \(orderedIds: string\[\]\) => Promise<void>/)
  assert.match(drawer, /onReorderTags: \(orderedIds: string\[\]\) => Promise<void>/)
  assert.doesNotMatch(drawer, /localStorage|sessionStorage|writeEncrypted|customizeRebuild/)
})

test('Home drawer uses the real OANIX logo through the configured app base', () => {
  assert.match(drawer, /import\.meta\.env\.BASE_URL/)
  assert.match(drawer, /oanix-logo\.webp/)
  assert.doesNotMatch(drawer, /src="\/oanix-logo\.webp"/)
})

test('folder and tag reordering uses one Sortable route and persists final ids', () => {
  assert.match(drawer, /Sortable\.create/)
  assert.match(drawer, /delayOnTouchOnly: true/)
  assert.match(drawer, /data-workspace-drag-handle/)
  assert.match(drawer, /data-workspace-item-id/)
  assert.match(drawer, /void onPersist\(orderedIds\)/)
  assert.doesNotMatch(drawer, /TouchEvent|touchmove|pointermove/)
})

test('drawer styling is isolated under workspace-drawer classes', () => {
  assert.match(css, /\.workspace-drawer/)
  assert.match(css, /\.workspace-drawer__item/)
  assert.match(css, /\.workspace-drawer__logo/)
})
