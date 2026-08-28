import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const visual = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')
const notes = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const history = readFileSync('src/features/versionHistory/VersionHistoryCenter.tsx', 'utf8')
const sidebar = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const icons = readFileSync('src/shared/OanixIcon.tsx', 'utf8')

test('v38.3 is the final header visual authority and retired icon polish is absent', () => {
  assert.equal(existsSync('src/styles/header-icon-polish.css'), false)
  assert.doesNotMatch(main, /\.\/styles\/header-icon-polish\.css/)
  const visualIndex = main.indexOf("./features/notes/v383WorkspaceVisual.css")
  const themeSurfaceIndex = main.indexOf("./styles/classic-theme-surfaces.css")
  assert.ok(themeSurfaceIndex >= 0)
  assert.ok(visualIndex > themeSurfaceIndex)
  assert.match(app, /<WorkspaceRuntimeGate workspaceRevision=\{workspaceRevision\} \/>/)
  assert.match(legacyGate, /<OrganicWorkspaceRuntime \/>/)
  assert.match(legacyGate, /<V383WorkspaceVisualRuntime \/>/)
})

test('workspace v2 visible header actions use the shared lightweight vector family', () => {
  assert.match(sidebar, /<OanixIcon name="search"/)
  assert.match(sidebar, /<OanixIcon name="lock"/)
  assert.match(sidebar, /<OanixIcon name="menu"/)
  assert.match(history, /<OanixIcon name="history"/)
  assert.match(app, /<OanixIcon name="user"/)
  for (const iconName of ['search', 'lock', 'menu', 'history', 'user']) {
    assert.ok(icons.includes(`'\${iconName}'`), `missing shared icon ${iconName}`)
  }
  assert.match(visual, /\.notes-header__actions[\s\S]*flex-flow: row nowrap !important/)
  assert.match(visual, /\.version-history-launcher \{ order: 3 !important; \}/)
  assert.match(visual, /\.account-header-action \{ order: 4 !important; \}/)
})

test('history and account launchers cannot render a second ghost glyph', () => {
  assert.match(visual, /\.version-history-launcher::after,[\s\S]*\.account-header-action::after[\s\S]*content: none !important/)
  assert.match(visual, /\.version-history-launcher[\s\S]*overflow: hidden !important/)
  assert.match(visual, /\.account-header-action[\s\S]*font-size: 0 !important/)
})

test('icon replacement preserves the real accessible actions', () => {
  assert.match(notes, /aria-label=\{searchOpen \? 'Cerrar búsqueda' : 'Buscar en notas'\}/)
  assert.match(notes, /aria-label="Bloquear OANIX"/)
  assert.match(history, /aria-label="Historial de versiones"/)
  assert.match(app, /aria-label="Cuenta de OANIX"/)
})
