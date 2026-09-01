import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const drawer = readFileSync('src/features/rebuild/WorkspaceDrawer.tsx', 'utf8')
const css = readFileSync('src/features/rebuild/workspaceDrawer.css', 'utf8')
const model = readFileSync('src/features/rebuild/rebuildModel.ts', 'utf8')
const customization = readFileSync('src/features/rebuild/WorkspaceCustomizationDialog.tsx', 'utf8')
const customizationService = readFileSync('src/features/rebuild/workspaceCustomizationService.ts', 'utf8')

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

test('mobile drawer gives folders and tags equal independent scroll areas', () => {
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*grid-template-rows: minmax\(0, 1fr\) minmax\(0, 1fr\)/)
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.workspace-drawer \.rebuild-drawer__list \{[\s\S]*overflow-y: auto/)
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*overscroll-behavior-y: contain/)
  assert.doesNotMatch(css, /@media \(max-width: 680px\)[\s\S]*overflow: visible/)
})

test('folder pin and favorite state is persisted in the encrypted v2 record and surfaced without parallel storage', () => {
  assert.match(model, /pinned\?: boolean/)
  assert.match(model, /favorite\?: boolean/)
  assert.match(customization, /aria-pressed=\{pinned\}/)
  assert.match(customization, /aria-pressed=\{favorite\}/)
  assert.match(customizationService, /nextPinned/)
  assert.match(customizationService, /nextFavorite/)
  assert.match(customizationService, /writeEncryptedV2Records/)
  assert.match(drawer, /folder\.pinned === true/)
  assert.match(drawer, /folder\.favorite === true/)
  assert.match(drawer, /workspace-drawer__marks/)
  assert.doesNotMatch(customization, /localStorage|sessionStorage|indexedDB/)
})
