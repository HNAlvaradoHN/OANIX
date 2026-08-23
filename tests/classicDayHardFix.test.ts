import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const catalog = readFileSync('src/features/personalization/themeCatalog.ts', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const hardFix = readFileSync('src/styles/classic-day-hard-fix.css', 'utf8')
const organic = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')

test('classic day pins a true white palette inline so dark legacy variables cannot win', () => {
  assert.match(catalog, /CLASSIC_DAY_TOKENS/)
  assert.match(catalog, /'--theme-bg': '#ffffff'/)
  assert.match(catalog, /classList\.toggle\('oanix-classic-day', enabled\)/)
  assert.match(catalog, /applyClassicDayHardening\(theme\.id === 'classic-day'\)/)
  assert.match(catalog, /swatches: \['#ffffff', '#f4f7fb', '#2563eb'\]/)
})

test('v38 organic workspace is the final visual authority after legacy theme CSS', () => {
  const dayIndex = main.indexOf("./styles/classic-day-hard-fix.css")
  const organicRuntimeIndex = main.indexOf("./features/notes/OrganicWorkspaceRuntime")
  assert.ok(dayIndex >= 0 && organicRuntimeIndex > dayIndex)

  assert.doesNotMatch(hardFix, /html\.oanix-classic-day \.notes-shell/)
  assert.doesNotMatch(hardFix, /html\.oanix-classic-day \.notes-header/)
  assert.doesNotMatch(hardFix, /html\.oanix-classic-day \.note-row\b/)

  assert.match(organic, /\.notes-shell[\s\S]*background: transparent !important/)
  assert.match(organic, /\.notes-sidebar[\s\S]*background: transparent !important/)
  assert.match(organic, /\.notes-header[\s\S]*background: var\(--oanix-organic-header\) !important/)
  assert.match(organic, /\.note-row[\s\S]*background: var\(--oanix-organic-card\) !important/)
  assert.match(organic, /backdrop-filter: blur\(15px\)/)
})

test('classic day hardening still protects non-workspace light surfaces', () => {
  assert.match(hardFix, /html\.oanix-classic-day \.oanix-theme-menu--workspace/)
  assert.match(hardFix, /background: rgba\(255,255,255,\.965\) !important/)
  assert.match(hardFix, /html\.oanix-classic-day \.oanix-theme-backdrop/)
})

test('classic day keeps the WebView canvas white through the Android gesture-navigation area', () => {
  assert.match(hardFix, /Match the WebView canvas to Android's transparent gesture-navigation area/)
  assert.match(hardFix, /min-height: 100dvh/)
  assert.match(hardFix, /background: #ffffff !important/)
})
