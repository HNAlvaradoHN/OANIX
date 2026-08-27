import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const catalog = readFileSync('src/features/personalization/themeCatalog.ts', 'utf8')
const systemBridge = readFileSync('src/features/personalization/systemThemeBridge.ts', 'utf8')
const menu = readFileSync('src/features/personalization/ThemeMenu.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const workspacePersonalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const organicWorkspaceCss = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
const menuCss = readFileSync('src/features/personalization/personalization.css', 'utf8')
const workspaceMenuCss = readFileSync('src/features/personalization/personalization-workspace.css', 'utf8')
const themeSurfaces = readFileSync('src/styles/theme-surfaces.css', 'utf8')
const classicThemeContract = readFileSync('src/styles/classic-theme-contract.css', 'utf8')
const notebookContract = readFileSync('src/styles/notebook-contract.css', 'utf8')
const classicSurfacesCss = readFileSync('src/styles/classic-theme-surfaces.css', 'utf8')
const androidStyles = readFileSync('android/app/src/main/res/values/styles.xml', 'utf8')
const mainActivity = readFileSync('android/app/src/main/java/io/github/hnalvaradohn/oanix/MainActivity.java', 'utf8')
const systemUiPlugin = readFileSync('android/app/src/main/java/io/github/hnalvaradohn/oanix/OanixSystemUiPlugin.java', 'utf8')

test('personalization exposes only classic day and night and migrates retired presets safely', () => {
  assert.match(catalog, /id: 'classic-day'/)
  assert.match(catalog, /id: 'classic-night'/)
  assert.match(catalog, /DEFAULT_OANIX_THEME[^\n]*= 'classic-night'/)
  assert.equal((catalog.match(/\n    id: '/g) ?? []).length, 2)

  const retiredIds = [
    'midnight-violet', 'cyber-blue', 'graphite-neon', 'obsidian-gold', 'crimson-core',
    'aurora-rose', 'pearl-violet', 'blush-glass', 'lavender-mist', 'ocean-pearl',
  ]
  for (const id of retiredIds) assert.doesNotMatch(catalog, new RegExp(`id: '${id}'`))

  assert.match(catalog, /LEGACY_LIGHT_THEMES/)
  assert.match(catalog, /'pearl-violet'/)
  assert.match(catalog, /return 'classic-day'/)
  assert.match(catalog, /return 'classic-night'/)
})

test('theme choice is only a local UI preference and applies before React paints', () => {
  assert.match(catalog, /window\.localStorage\.setItem\(OANIX_THEME_STORAGE_KEY, theme\.id\)/)
  assert.match(catalog, /root\.dataset\.oanixTheme = theme\.id/)
  assert.doesNotMatch(catalog, /supabase|encrypted_records|sync_records/i)
  assert.match(main, /applyOanixTheme\(readSavedOanixTheme\(\), false\)/)
  assert.match(main, /<ThemeMenu \/>/)
  assert.match(main, /styles\/theme-surfaces\.css/)
  assert.match(main, /styles\/classic-theme-contract\.css/)
  assert.match(main, /styles\/notebook-contract\.css/)
  assert.match(main, /styles\/classic-theme-surfaces\.css/)
  assert.doesNotMatch(main, /styles\/themes\.css|base-themes\.css|notebook-polish\.css|final-visual-polish|classic-day-hard-fix/)
})

test('the workspace three-dot menu keeps security but no longer duplicates Day Night', () => {
  assert.match(menu, /const WORKSPACE_MENU_SELECTOR = '\.workspace-menu\[role="menu"\]'/)
  assert.match(menu, /querySelector<HTMLElement>\(WORKSPACE_MENU_SELECTOR\)/)
  assert.match(menu, /createPortal/)
  assert.match(menu, /role="menuitem"/)
  assert.match(menu, />Seguridad</)
  assert.match(menu, /Bloqueo automático/)
  assert.doesNotMatch(menu, />Apariencia</)
  assert.doesNotMatch(menu, /Día o Noche/)
  assert.doesNotMatch(menu, /OANIX_BASE_THEMES|renderThemeOption|chooseTheme/)
  assert.match(workspaceMenuCss, /\.oanix-personalization__workspace-entry/)
  assert.match(workspaceMenuCss, /\.workspace-menu > button:last-of-type/)
})

test('security panel is part of the safe menu area so clicks cannot fall through to notes', () => {
  assert.match(workspace, /target\.closest\('\[data-note-menu-root="true"\]'\)/)
  assert.match(menu, /data-note-menu-root="true"/)
  assert.match(menu, /panelRef\.current\?\.contains\(target\)/)
  assert.match(menu, /oanix-theme-backdrop/)
  assert.match(workspaceMenuCss, /\.oanix-theme-backdrop/)
})

test('closing security also closes the workspace menu left behind it', () => {
  assert.match(menu, /function closeSecurityAndWorkspaceMenu\(\)/)
  assert.match(menu, /aria-label="Menú de OANIX"/)
  assert.match(menu, /getAttribute\('aria-expanded'\) === 'true'/)
  assert.match(menu, /opener\.click\(\)/)
  assert.match(menu, /onClick=\{closeSecurityAndWorkspaceMenu\}/)
})

test('Day Night has one workspace control in the bottom folder capsule while security keeps auto lock', () => {
  assert.match(workspacePersonalization, /data-oanix-theme-toggle/)
  assert.match(workspacePersonalization, /applyOanixTheme\(current === 'classic-day' \? 'classic-night' : 'classic-day'\)/)
  assert.match(menu, /AUTO_LOCK_OPTIONS/)
  assert.match(menuCss, /\.oanix-theme-menu/)
  assert.doesNotMatch(menu, /OANIX_BASE_THEMES/)
})

test('classic day and night define neutral semantic palettes', () => {
  assert.match(classicThemeContract, /data-oanix-theme='classic-day'/)
  assert.match(classicThemeContract, /data-oanix-theme='classic-night'/)
  assert.match(classicThemeContract, /--theme-bg:/)
  assert.match(classicThemeContract, /--theme-surface:/)
  assert.match(classicThemeContract, /--theme-text:/)
  assert.match(classicThemeContract, /classic-day'[\s\S]*--theme-bg: #eef2f5/)
  assert.match(classicThemeContract, /classic-day'[\s\S]*--theme-accent: #2563eb/)
  assert.match(classicThemeContract, /classic-night'[\s\S]*--theme-bg: #05070b/)
  assert.match(classicThemeContract, /classic-night'[\s\S]*--theme-accent: #8aaeff/)
})

test('classic day explicitly opts out of mobile forced dark and hardens the shared workspace tokens', () => {
  assert.match(classicThemeContract, /data-oanix-theme='classic-day'[^\n]*\{[\s\S]*color-scheme: only light !important/)
  assert.match(catalog, /const colorScheme = theme\.mode === 'light' \? 'only light' : 'dark'/)
  assert.match(catalog, /setProperty\('color-scheme', colorScheme, 'important'\)/)
  assert.match(catalog, /'--oanix-organic-card': 'rgba\(241,245,249,\.86\)'/)
  assert.match(classicSurfacesCss, /data-oanix-theme='classic-day'[\s\S]*--theme-bg: #f4f7fb/)
})

test('v38 organic CSS owns workspace surfaces instead of competing Day overrides', () => {
  assert.doesNotMatch(classicThemeContract, /data-oanix-theme='classic-day'[^\n]*\][\s\S]*\.notes-shell/)
  assert.doesNotMatch(classicThemeContract, /data-oanix-theme='classic-day'[^\n]*\][\s\S]*\.notes-sidebar/)
  assert.doesNotMatch(classicThemeContract, /data-oanix-theme='classic-day'[^\n]*\][\s\S]*\.notes-header/)
  assert.doesNotMatch(classicThemeContract, /data-oanix-theme='classic-day'[^\n]*\][\s\S]*\.note-row\s*\{/)
  assert.doesNotMatch(classicSurfacesCss, /html\.oanix-classic-day \.notes-shell/)
  assert.doesNotMatch(classicSurfacesCss, /html\.oanix-classic-day \.notes-header/)
  assert.doesNotMatch(classicSurfacesCss, /html\.oanix-classic-day \.note-row\s*\{/)

  assert.match(organicWorkspaceCss, /\.notes-shell[\s\S]*background: transparent !important/)
  assert.match(organicWorkspaceCss, /\.notes-sidebar[\s\S]*background: transparent !important/)
  assert.match(organicWorkspaceCss, /\.notes-header[\s\S]*background: var\(--oanix-organic-header\) !important/)
  assert.match(organicWorkspaceCss, /\.note-row[\s\S]*background: var\(--oanix-organic-card\) !important/)
  assert.match(organicWorkspaceCss, /backdrop-filter: blur\(15px\)/)

  const themeSurfaceIndex = main.indexOf("./styles/classic-theme-surfaces.css")
  const visualIndex = main.indexOf("./features/notes/v383WorkspaceVisual.css")
  assert.ok(themeSurfaceIndex >= 0 && visualIndex > themeSurfaceIndex)
  assert.match(app, /<WorkspaceRuntimeGate \/>/)
  assert.match(gate, /<OrganicWorkspaceRuntime \/>/)
})

test('selected theme also controls browser and Android system chrome', () => {
  assert.match(catalog, /syncOanixSystemTheme\(theme\.swatches\[0\], theme\.mode\)/)
  assert.match(systemBridge, /meta\[name="theme-color"\]/)
  assert.match(systemBridge, /Capacitor\.isNativePlatform\(\)/)
  assert.match(systemBridge, /registerPlugin<OanixSystemUiPlugin>\('OanixSystemUi'\)/)
  assert.match(mainActivity, /registerPlugin\(OanixSystemUiPlugin\.class\)/)
  assert.match(systemUiPlugin, /setNavigationBarColor\(color\)/)
  assert.match(systemUiPlugin, /setStatusBarColor\(color\)/)
  assert.match(systemUiPlugin, /setBackgroundColor\(color\)/)
})

test('Android host never force-darkens web presets', () => {
  assert.match(androidStyles, /Theme\.AppCompat\.Light\.NoActionBar/)
  assert.match(androidStyles, /android:forceDarkAllowed">false/)
  assert.doesNotMatch(androidStyles, /Theme\.AppCompat\.DayNight\.NoActionBar/)
})

test('theme surface layer fixes the three visual details found during review', () => {
  assert.match(themeSurfaces, /\.mobile-editor-dock[\s\S]*background: color-mix/)
  assert.match(themeSurfaces, /\.notes-tab[\s\S]*text-overflow: ellipsis/)
  assert.match(themeSurfaces, /\.note-title-field input[\s\S]*font-size: clamp\(1\.85rem, 4\.6cqw, 3\.25rem\)/)
})

test('notebook cues stay subtle and theme-aware', () => {
  assert.match(notebookContract, /repeating-linear-gradient/)
  assert.match(notebookContract, /var\(--theme-border\)/)
  assert.match(notebookContract, /\.editor-frame::after/)
  assert.doesNotMatch(notebookContract, /spiral|binder|paper texture/i)
})

test('shared theme surface layer still maps semantic tokens used by major surfaces', () => {
  assert.match(themeSurfaces, /--theme-bg:/)
  assert.match(themeSurfaces, /--theme-surface:/)
  assert.match(themeSurfaces, /--theme-accent:/)
  assert.match(themeSurfaces, /--theme-border:/)
  assert.match(themeSurfaces, /\.note-row[\s\S]*var\(--theme-surface-2\)/)
  assert.match(themeSurfaces, /\.editor-frame[\s\S]*var\(--theme-surface-2\)/)
})
