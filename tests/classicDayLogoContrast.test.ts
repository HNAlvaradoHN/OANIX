import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const brandCss = readFileSync('src/styles/web-brand-logo.css', 'utf8')
const classicThemeSurfaces = readFileSync('src/styles/classic-theme-surfaces.css', 'utf8')

test('Classic Day keeps the real OANIX logo readable without duplicating workspace branding', () => {
  assert.match(brandCss, /html\.oanix-brand-final \.notes-brand__mark/)
  assert.match(brandCss, /background-image: var\(--oanix-brand-logo-url\) !important/)
  assert.match(brandCss, /background-color: #15171b !important/)
  assert.match(brandCss, /html\.oanix-brand-final\.oanix-classic-day[\s\S]*\.notes-brand__mark/)
  assert.match(brandCss, /border-color: rgba\(15, 23, 42, \.20\) !important/)
  assert.match(brandCss, /The old purple\/cyan orbital nucleus is decorative history/)
  assert.match(brandCss, /content: none !important/)

  // Theme surface hardening must not become another visual owner for the workspace logo.
  assert.doesNotMatch(classicThemeSurfaces, /\.notes-brand__mark/)
})
