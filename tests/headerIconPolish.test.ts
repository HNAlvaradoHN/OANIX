import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const themeVisualStyles = readFileSync('src/app/ThemeVisualStyles.ts', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const visual = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')
const notes = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const rebuild = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const history = readFileSync('src/features/versionHistory/VersionHistoryCenter.tsx', 'utf8')
const sidebar = readFileSync('src/features/notes/themes/infographic/InfographicWorkspace.tsx', 'utf8')
const icons = readFileSync('src/shared/OanixIcon.tsx', 'utf8')
const v2Css = readFileSync('src/features/notes/themes/infographic/infographicTheme.css', 'utf8')

test('retired v38.3 header stays historical while the rebuild owns the unlocked shell', () => {
  assert.equal(existsSync('src/styles/header-icon-polish.css'), false)
  assert.doesNotMatch(main, /\.\/styles\/header-icon-polish\.css/)
  assert.match(main, /\.\/app\/ThemeVisualStyles/)
  assert.match(themeVisualStyles, /\.\.\/styles\/classic-theme-surfaces\.css/)
  assert.doesNotMatch(main, /\.\/styles\/classic-theme-surfaces\.css/)
  assert.doesNotMatch(main, /features\/notes\/v383WorkspaceVisual\.css/)
  assert.match(visualRuntime, /\.\/v383WorkspaceVisual\.css/)
  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /<WorkspaceRuntimeGate/)
  assert.match(legacyGate, /<OrganicWorkspaceRuntime \/>/)
  assert.match(legacyGate, /<V383WorkspaceVisualRuntime \/>/)
})

test('rebuild visible header actions use the shared lightweight vector family', () => {
  assert.match(sidebar, /<OanixIcon name="search"/)
  assert.match(sidebar, /<OanixIcon name="lock"/)
  assert.match(sidebar, /<OanixIcon name="menu"/)
  assert.match(history, /<OanixIcon name="history"/)
  assert.match(rebuild, /<OanixIcon name="user"/)
  for (const iconName of ['search', 'lock', 'menu', 'history', 'user']) {
    assert.ok(icons.includes(`'${iconName}'`), `missing shared icon ${iconName}`)
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
  assert.match(rebuild, /aria-label="Cuenta de OANIX"/)
})


test('current OANIX header actions stay intact inside the isolated infographic theme', () => {
  assert.match(icons, /'data-oanix-icon': name/)
  assert.match(icons, /strokeWidth: 1\.9/)
  assert.match(v2Css, /oanix-infographic-header__actions > :is\([\s\S]*version-history-launcher[\s\S]*account-header-action/)
  assert.match(sidebar, /className="notes-header__actions oanix-infographic-header__actions"/)
  assert.match(sidebar, /onClick=\{onSearchToggle\}/)
  assert.match(sidebar, /onClick=\{onLock\}/)
  assert.match(sidebar, /onClick=\{onWorkspaceMenuToggle\}/)
  assert.match(sidebar, /<div className="oanix-infographic-brand__text">[\s\S]*<strong>OANIX<\/strong>[\s\S]*<\/div>/)
  assert.doesNotMatch(sidebar, /activeFolderName/)
  assert.match(v2Css, /aria-label="Buscar en notas"[\s\S]*order: 1/)
  assert.match(v2Css, /aria-label="Bloquear OANIX"[\s\S]*order: 2/)
  assert.match(v2Css, /version-history-launcher[\s\S]*order: 3/)
  assert.match(v2Css, /account-header-action[\s\S]*order: 4/)
  assert.match(v2Css, /workspace-menu-wrap[\s\S]*order: 5/)
  assert.match(v2Css, /--inf-header-height: 52px/)
  assert.match(v2Css, /\.oanix-infographic-header \{[\s\S]*height: calc\(var\(--inf-header-height\) \+ env\(safe-area-inset-top\)\) !important/)
  assert.match(v2Css, /html\.oanix-brand-final \.oanix-infographic-theme \.oanix-infographic-brand__logo \{[\s\S]*width: 34px !important[\s\S]*height: 34px !important/)
  assert.match(v2Css, /\.oanix-infographic-main \{[\s\S]*padding-top: calc\(var\(--inf-header-height\) \+ env\(safe-area-inset-top\)\)/)
  assert.match(v2Css, /:root\[data-oanix-theme\] \.oanix-infographic-theme \.oanix-infographic-header[\s\S]*background: var\(--inf-topbar\) !important/)
  assert.match(v2Css, /oanix-infographic-header__actions[\s\S]*color: var\(--inf-text-main\) !important/)
})
