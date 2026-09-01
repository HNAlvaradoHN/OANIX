import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const controller = readFileSync('src/features/rebuild/WorkspaceHomeController.tsx', 'utf8')

test('active Home uses the replaceable workspace controller instead of a second inline drawer', () => {
  assert.match(app, /import \{ WorkspaceHomeController \}/)
  assert.match(app, /<WorkspaceHomeController/)
  assert.doesNotMatch(app, /<aside className=\{`rebuild-drawer/)
})

test('active Home applies persistent folder colors to folder surfaces', () => {
  assert.match(app, /folderAccent\(folder\)/)
  assert.match(app, /folderSurfaceCss\(folder, 0\.16\)/)
  assert.match(app, /folderSurfaceCss\(activeFolder, 0\.28\)/)
  assert.doesNotMatch(app, /folderGradientCss\(activeFolder\.gradientIndex/)
})

test('active Home loads only the selected folder cover and never scans all cover assets', () => {
  assert.match(controller, /activeFolderId \? folderById\.get\(activeFolderId\)/)
  assert.match(controller, /readWorkspaceFolderCover\(assetId\)/)
  assert.doesNotMatch(controller, /Promise\.all\(folders|folders\.map\([^\n]*readWorkspaceFolderCover/)
})

test('real OANIX logo is resolved from the app base in the active Home header', () => {
  assert.match(app, /import\.meta\.env\.BASE_URL/)
  assert.match(app, /oanix-logo\.webp/)
  assert.match(app, /<img[\s\S]*rebuild-brand__badge/)
})

test('manual tag order is not replaced by alphabetical sorting after creation', () => {
  assert.match(app, /setTags\(\(current\) => \[\.\.\.current, tag\]\)/)
  assert.doesNotMatch(app, /localeCompare\(right\.name/)
})
