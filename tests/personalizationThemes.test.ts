import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const catalog = readFileSync('src/features/personalization/themeCatalog.ts', 'utf8')
const menu = readFileSync('src/features/personalization/ThemeMenu.tsx', 'utf8')
const menuCss = readFileSync('src/features/personalization/personalization.css', 'utf8')
const themesCss = readFileSync('src/styles/themes.css', 'utf8')

test('personalization exposes ten named presets and keeps Midnight Violet as default', () => {
  const ids = [
    'midnight-violet', 'cyber-blue', 'graphite-neon', 'obsidian-gold', 'crimson-core',
    'aurora-rose', 'pearl-violet', 'blush-glass', 'lavender-mist', 'ocean-pearl',
  ]
  for (const id of ids) assert.match(catalog, new RegExp(`id: '${id}'`))
  assert.match(catalog, /DEFAULT_OANIX_THEME = 'midnight-violet'/)
  assert.equal((catalog.match(/\bid: '/g) ?? []).length, 10)
})

test('theme choice is only a local UI preference and applies before React paints', () => {
  assert.match(catalog, /window\.localStorage\.setItem\(OANIX_THEME_STORAGE_KEY, theme\.id\)/)
  assert.match(catalog, /document\.documentElement\.dataset\.oanixTheme = theme\.id/)
  assert.doesNotMatch(catalog, /sync|supabase|encrypted_records/i)
  assert.match(main, /applyOanixTheme\(readSavedOanixTheme\(\), false\)/)
  assert.match(main, /<ThemeMenu \/>/)
  assert.match(main, /styles\/themes\.css/)
})

test('personalization is a dedicated dropdown with dark and light options', () => {
  assert.match(menu, /Personalización/)
  assert.match(menu, /Elegí tu ambiente/)
  assert.match(menu, /aria-expanded=\{open\}/)
  assert.match(menu, /theme\.mode === 'dark' \? 'Oscuro' : 'Claro'/)
  assert.match(menuCss, /\.oanix-theme-menu/)
  assert.match(menuCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('theme layer fixes the three visual details found during review', () => {
  assert.match(themesCss, /\.mobile-editor-dock[\s\S]*background: color-mix/)
  assert.match(themesCss, /\.notes-tab[\s\S]*text-overflow: ellipsis/)
  assert.match(themesCss, /\.note-title-field input[\s\S]*font-size: clamp\(1\.85rem, 4\.6cqw, 3\.25rem\)/)
})

test('all presets define shared semantic tokens used by major surfaces', () => {
  assert.match(themesCss, /--theme-bg:/)
  assert.match(themesCss, /--theme-surface:/)
  assert.match(themesCss, /--theme-accent:/)
  assert.match(themesCss, /--theme-border:/)
  assert.match(themesCss, /\.note-row[\s\S]*var\(--theme-surface-2\)/)
  assert.match(themesCss, /\.editor-frame[\s\S]*var\(--theme-surface-2\)/)
})
