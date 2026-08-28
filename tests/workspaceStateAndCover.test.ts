import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const organicRuntime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const stateCss = readFileSync('src/features/notes/workspaceStateContract.css', 'utf8')
const coverService = readFileSync('src/features/folders/folderCoverService.ts', 'utf8')
const appearanceService = readFileSync('src/features/folders/folderAppearanceService.ts', 'utf8')

test('opening a note marks an exclusive detail state and hides workspace-only chrome', () => {
  assert.match(visualRuntime, /shell\?\.classList\.contains\('notes-shell--open'\)/)
  assert.match(visualRuntime, /classList\.toggle\('oanix-note-detail-open', noteDetailOpen\)/)
  assert.match(stateCss, /oanix-note-detail-open[\s\S]*\.oanix-folder-grid/)
  assert.match(stateCss, /oanix-note-detail-open[\s\S]*\.oanix-organic-folder-controls/)
  assert.match(stateCss, /oanix-note-detail-open[\s\S]*\.notes-create-fab/)
  assert.match(stateCss, /oanix-note-detail-open[\s\S]*\.notes-sidebar/)
  assert.match(stateCss, /\.notes-shell\.notes-shell--open > \.note-view[\s\S]*width: 100% !important/)
})

test('visual runtime observes only note detail state', () => {
  assert.match(visualRuntime, /shellObserver\.observe\((?:observedShell|shell)/)
  assert.doesNotMatch(visualRuntime, /backgroundObserver|syncCoveredBackground|bindBackgroundObserver/)
  assert.doesNotMatch(visualRuntime, /observe\(body/)
  assert.doesNotMatch(visualRuntime, /subtree:\s*true/)
})

test('covered workspace writes the cover variable directly without a rewrite frame', () => {
  assert.match(organicRuntime, /'--oanix-organic-cover-image'/)
  assert.doesNotMatch(organicRuntime, /backgroundImage:/)
  assert.doesNotMatch(visualRuntime, /removeProperty\('background-image'\)|setProperty\('--oanix-organic-cover-image'/)
  assert.match(stateCss, /\.oanix-organic-background\.oanix-organic-background--covered::before[\s\S]*background-size: cover !important[\s\S]*blur\(18px\)/)
  assert.match(stateCss, /\.oanix-organic-background\.oanix-organic-background--covered::after[\s\S]*background-size: cover, contain !important/)
  assert.match(stateCss, /var\(--oanix-organic-cover-image\)/)
})

test('folder cover preparation preserves aspect ratio at useful screen resolution', () => {
  assert.match(coverService, /MAX_COVER_EDGE = 1440/)
  assert.doesNotMatch(coverService, /COVER_SIZE\s*=\s*256/)
  assert.match(coverService, /Math\.min\(1, MAX_COVER_EDGE \/ Math\.max\(width, height\)\)/)
  assert.match(coverService, /canvas\.width = size\.width/)
  assert.match(coverService, /canvas\.height = size\.height/)
  assert.match(coverService, /imageSmoothingQuality = 'high'/)
  assert.match(coverService, /image\.naturalWidth,[\s\S]*image\.naturalHeight,[\s\S]*size\.width,[\s\S]*size\.height/)
})

test('folder appearance writes are serialized per folder so rapid personalization cannot overwrite adjacent changes', () => {
  assert.match(appearanceService, /appearanceWriteQueues = new Map<string, Promise<void>>\(\)/)
  assert.match(appearanceService, /function serializeAppearanceWrite\(folderId: string/)
  assert.match(appearanceService, /appearanceWriteQueues\.set\(folderId, next\)/)
  assert.match(appearanceService, /saveFolderColor[\s\S]*serializeAppearanceWrite\(folderId/)
  assert.match(appearanceService, /saveFolderIcon[\s\S]*serializeAppearanceWrite\(folderId/)
  assert.match(appearanceService, /saveFolderPinned[\s\S]*serializeAppearanceWrite\(folderId/)
  assert.match(appearanceService, /saveFolderFavorite[\s\S]*serializeAppearanceWrite\(folderId/)
})

test('exclusive legacy state contract loads after the v38.3 base inside the lazy fallback', () => {
  const baseIndex = legacyGate.indexOf("../features/notes/v383WorkspaceVisual.css")
  const stateIndex = legacyGate.indexOf("../features/notes/workspaceStateContract.css")
  assert.ok(baseIndex >= 0 && stateIndex > baseIndex)
  assert.doesNotMatch(main, /features\/notes\/(?:v383WorkspaceVisual|workspaceStateContract)\.css/)
})
