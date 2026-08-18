import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const catalog = readFileSync('src/features/personalization/themeCatalog.ts', 'utf8')
const menu = readFileSync('src/features/personalization/ThemeMenu.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const menuCss = readFileSync('src/features/personalization/personalization.css', 'utf8')
const workspaceMenuCss = readFileSync('src/features/personalization/personalization-workspace.css', 'utf8')
const themesCss = readFileSync('src/styles/themes.css', 'utf8')
const baseThemesCss = readFileSync('src/styles/base-themes.css', 'utf8')
const notebookCss = readFileSync('src/styles/notebook-polish.css', 'utf8')

test('personalization keeps ten styled presets plus classic day and night bases', () => {
  const styledIds = [
    'midnight-violet', 'cyber-blue', 'graphite-neon', 'obsidian-gold', 'crimson-core',
    'aurora-rose', 'pearl-violet', 'blush-glass', 'lavender-mist', 'ocean-pearl',
  ]
  for (const id of styledIds) assert.match(catalog, new RegExp(`id: '${id}'`))
  assert.match(catalog, /id: 'classic-day'/)
  assert.match(catalog, /id: 'classic-night'/)
  assert.match(catalog, /kind: 'base'/)
  assert.match(catalog, /kind: 'style'/)
  assert.match(catalog, /DEFAULT_OANIX_THEME = 'midnight-violet'/)
  assert.equal((catalog.match(/\bid: '/g) ?? []).length, 12)
})

test('theme choice is only a local UI preference and applies before React paints', () => {
  assert.match(catalog, /window\.localStorage\.setItem\(OANIX_THEME_STORAGE_KEY, theme\.id\)/)
  assert.match(catalog, /document\.documentElement\.dataset\.oanixTheme = theme\.id/)
  assert.doesNotMatch(catalog, /sync|supabase|encrypted_records/i)
  assert.match(main, /applyOanixTheme\(readSavedOanixTheme\(\), false\)/)
  assert.match(main, /<ThemeMenu \/>/)
  assert.match(main, /styles\/themes\.css/)
  assert.match(main, /styles\/base-themes\.css/)
})

test('personalization lives inside the workspace three-dot menu instead of a floating header trigger', () => {
  assert.match(menu, /querySelector<HTMLElement>\('\.workspace-menu\[role="menu"\]'\)/)
  assert.match(menu, /createPortal/)
  assert.match(menu, /role="menuitem"/)
  assert.match(menu, />Personalización</)
  assert.match(menu, /OANIX_BASE_THEMES/)
  assert.match(menu, /OANIX_STYLE_THEMES/)
  assert.doesNotMatch(menu, /oanix-personalization__trigger-label/)
  assert.match(workspaceMenuCss, /\.oanix-personalization__workspace-entry/)
  assert.match(workspaceMenuCss, /\.workspace-menu > button:last-of-type/)
})

test('theme panel is part of the safe menu area so clicks cannot fall through to notes', () => {
  assert.match(workspace, /target\.closest\('\[data-note-menu-root="true"\]'\)/)
  assert.match(menu, /data-note-menu-root="true"/)
  assert.match(menu, /panelRef\.current\?\.contains\(target\)/)
})

test('personalization panel still exposes dark and light options', () => {
  assert.match(menu, /Elegí tu ambiente/)
  assert.match(menu, /theme\.mode === 'dark' \? 'Oscuro' : 'Claro'/)
  assert.match(menuCss, /\.oanix-theme-menu/)
  assert.match(menuCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('classic day and night define neutral semantic palettes', () => {
  assert.match(baseThemesCss, /data-oanix-theme='classic-day'/)
  assert.match(baseThemesCss, /data-oanix-theme='classic-night'/)
  assert.match(baseThemesCss, /--theme-bg:/)
  assert.match(baseThemesCss, /--theme-surface:/)
  assert.match(baseThemesCss, /--theme-text:/)
})

test('theme layer fixes the three visual details found during review', () => {
  assert.match(themesCss, /\.mobile-editor-dock[\s\S]*background: color-mix/)
  assert.match(themesCss, /\.notes-tab[\s\S]*text-overflow: ellipsis/)
  assert.match(themesCss, /\.note-title-field input[\s\S]*font-size: clamp\(1\.85rem, 4\.6cqw, 3\.25rem\)/)
})

test('notebook cues stay subtle and theme-aware', () => {
  assert.match(notebookCss, /repeating-linear-gradient/)
  assert.match(notebookCss, /var\(--theme-border\)/)
  assert.match(notebookCss, /\.editor-frame::after/)
  assert.doesNotMatch(notebookCss, /spiral|binder|paper texture/i)
})

test('all presets define shared semantic tokens used by major surfaces', () => {
  assert.match(themesCss, /--theme-bg:/)
  assert.match(themesCss, /--theme-surface:/)
  assert.match(themesCss, /--theme-accent:/)
  assert.match(themesCss, /--theme-border:/)
  assert.match(themesCss, /\.note-row[\s\S]*var\(--theme-surface-2\)/)
  assert.match(themesCss, /\.editor-frame[\s\S]*var\(--theme-surface-2\)/)
})
