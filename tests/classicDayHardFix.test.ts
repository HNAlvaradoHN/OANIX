import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const catalog = readFileSync('src/features/personalization/themeCatalog.ts', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const classicThemeSurfaces = readFileSync('src/styles/classic-theme-surfaces.css', 'utf8')
const visual = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')

test('classic day pins a true white palette inline so dark legacy variables cannot win', () => {
  assert.match(catalog, /CLASSIC_DAY_TOKENS/)
  assert.match(catalog, /'--theme-bg': '#ffffff'/)
  assert.match(catalog, /classList\.toggle\('oanix-classic-day', enabled\)/)
  assert.match(catalog, /applyClassicDayHardening\(theme\.id === 'classic-day'\)/)
  assert.match(catalog, /swatches: \['#ffffff', '#f4f7fb', '#2563eb'\]/)
})

test('v38.3 contract is loaded after classic theme surfaces and owns workspace surfaces', () => {
  const dayIndex = main.indexOf("./styles/classic-theme-surfaces.css")
  const visualIndex = main.indexOf("./features/notes/v383WorkspaceVisual.css")
  assert.ok(dayIndex >= 0 && visualIndex > dayIndex)

  assert.doesNotMatch(classicThemeSurfaces, /html\.oanix-classic-day \.notes-shell/)
  assert.doesNotMatch(classicThemeSurfaces, /html\.oanix-classic-day \.notes-header/)
  assert.doesNotMatch(classicThemeSurfaces, /html\.oanix-classic-day \.note-row\b/)

  assert.match(visual, /html\.oanix-v383-visual \.notes-shell[\s\S]*background: transparent !important/)
  assert.match(visual, /html\.oanix-v383-visual \.notes-sidebar[\s\S]*background: transparent !important/)
  assert.match(visual, /html\.oanix-v383-visual \.notes-header[\s\S]*background: var\(--v383-header\) !important/)
  assert.match(visual, /html\.oanix-v383-visual \.note-row[\s\S]*background: var\(--v383-card\) !important/)
  assert.match(visual, /backdrop-filter: blur\(15px\) !important/)
  assert.match(visual, /color-scheme: light only !important/)
})

test('classic day hardening still protects non-workspace light surfaces', () => {
  assert.match(classicThemeSurfaces, /html\.oanix-classic-day \.oanix-theme-menu--workspace/)
  assert.match(classicThemeSurfaces, /background: rgba\(255,255,255,\.965\) !important/)
  assert.match(classicThemeSurfaces, /html\.oanix-classic-day \.oanix-theme-backdrop/)
})

test('classic day keeps the WebView canvas white through the Android gesture-navigation area', () => {
  assert.match(classicThemeSurfaces, /Match the WebView canvas to Android's transparent gesture-navigation area/)
  assert.match(classicThemeSurfaces, /min-height: 100dvh/)
  assert.match(classicThemeSurfaces, /background: #ffffff !important/)
})
