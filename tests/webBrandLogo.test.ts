import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const icon = readFileSync('public/oanix-icon.svg', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const brandCss = readFileSync('src/styles/web-brand-logo.css', 'utf8')

test('web icon keeps the approved black silver orange identity', () => {
  assert.match(icon, /<rect x="18" y="18" width="476" height="476" rx="112" fill="url\(#bg\)"/)
  assert.match(icon, /id="silver"/)
  assert.match(icon, /id="orange"/)
  assert.match(icon, /Símbolo OANIX con O plateada, documento y candado naranja sobre fondo negro/)
  assert.match(icon, /#ff6a16/)
})

test('new brand preview is enabled on web but deliberately excluded from Capacitor', () => {
  assert.match(main, /import '\.\/styles\/web-brand-logo\.css'/)
  assert.match(main, /if \(import\.meta\.env\.MODE !== 'capacitor'\) \{\s*document\.documentElement\.classList\.add\('oanix-web-brand-preview'\)/)
  assert.match(brandCss, /html\.oanix-web-brand-preview \.vault-logo/)
  assert.match(brandCss, /html\.oanix-web-brand-preview \.notes-brand__mark/)
  assert.match(brandCss, /background-image: url\('\/OANIX\/oanix-icon\.svg'\) !important/)
  assert.match(brandCss, /\.vault-logo::before/)
  assert.match(brandCss, /content: none !important/)
})
