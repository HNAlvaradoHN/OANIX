import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const catalog = readFileSync('src/features/personalization/themeCatalog.ts', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const hardFix = readFileSync('src/styles/classic-day-hard-fix.css', 'utf8')

test('classic day pins a true white palette inline so dark legacy variables cannot win', () => {
  assert.match(catalog, /CLASSIC_DAY_TOKENS/)
  assert.match(catalog, /'--theme-bg': '#ffffff'/)
  assert.match(catalog, /classList\.toggle\('oanix-classic-day', enabled\)/)
  assert.match(catalog, /applyClassicDayHardening\(theme\.id === 'classic-day'\)/)
  assert.match(catalog, /swatches: \['#ffffff', '#f4f7fb', '#2563eb'\]/)
})

test('classic day hard fix loads last and forces white workspace and personalization surfaces', () => {
  const iconIndex = main.indexOf("./styles/header-icon-polish.css")
  const dayIndex = main.indexOf("./styles/classic-day-hard-fix.css")
  assert.ok(iconIndex >= 0 && dayIndex > iconIndex)
  assert.match(hardFix, /html\.oanix-classic-day \.notes-sidebar/)
  assert.match(hardFix, /html\.oanix-classic-day \.oanix-theme-menu--workspace/)
  assert.match(hardFix, /background: rgba\(255,255,255,\.985\) !important/)
  assert.match(hardFix, /html\.oanix-classic-day \.oanix-theme-backdrop/)
})

test('classic day keeps the WebView canvas white through the Android gesture-navigation area', () => {
  assert.match(hardFix, /Match the WebView canvas to Android's transparent gesture-navigation area/)
  assert.match(hardFix, /min-height: 100dvh/)
  assert.match(hardFix, /background: #ffffff !important/)
})
