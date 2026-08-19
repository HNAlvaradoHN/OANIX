import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const icon = readFileSync('public/oanix-icon.svg', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const brandCss = readFileSync('src/styles/web-brand-logo.css', 'utf8')
const viteConfig = readFileSync('vite.config.ts', 'utf8')
const androidVector = readFileSync('android/app/src/main/res/drawable/oanix_launcher_foreground_vector.xml', 'utf8')
const androidTile = readFileSync('android/app/src/main/res/drawable/oanix_launcher_tile.xml', 'utf8')
const androidLegacy = readFileSync('android/app/src/main/res/mipmap-anydpi/ic_launcher.xml', 'utf8')
const androidForeground = readFileSync('android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.xml', 'utf8')
const androidAdaptive = readFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'utf8')

test('official OANIX mark keeps the bright C secure-notebook identity', () => {
  assert.match(icon, /<rect x="20" y="20" width="472" height="472" rx="104" fill="url\(#bg\)"/)
  assert.match(icon, /id="silver"/)
  assert.match(icon, /id="page"/)
  assert.match(icon, /id="orangeBright"/)
  assert.match(icon, /C blanca plateada con destello/)
  assert.match(icon, /Small light flare on the C/)
  assert.match(icon, /Raised graphite notebook/)
  assert.match(icon, /Bright orange note rulings/)
  assert.match(icon, />OANI</)
  assert.match(icon, />X</)
})

test('final identity is enabled in both PWA and Capacitor with a base-aware asset URL', () => {
  assert.match(main, /document\.documentElement\.classList\.add\('oanix-brand-final'\)/)
  assert.match(main, /import\.meta\.env\.BASE_URL/)
  assert.match(main, /oanix-icon\.svg/)
  assert.match(brandCss, /html\.oanix-brand-final \.vault-logo/)
  assert.match(brandCss, /html\.oanix-brand-final \.notes-brand__mark/)
  assert.match(brandCss, /background-image: var\(--oanix-brand-logo-url\) !important/)
  assert.doesNotMatch(main, /classList\.add\('oanix-web-brand-preview'\)/)
})

test('PWA does not ask Android launchers to crop the complete wordmark as a maskable icon', () => {
  assert.match(viteConfig, /purpose: 'any'/)
  assert.doesNotMatch(viteConfig, /purpose: 'any maskable'/)
})

test('Android launcher keeps the complete logo in a conservative safe zone with solid orange notebook rulings', () => {
  assert.match(androidVector, /android:scaleX="0\.62"/)
  assert.match(androidVector, /android:scaleY="0\.62"/)
  assert.match(androidVector, /#ECEDEF/)
  assert.match(androidVector, /#FFFFFF/)
  assert.match(androidVector, /#41464D/)
  assert.match(androidVector, /Filled bars are used instead of thin strokes/)
  assert.match(androidVector, /M51\.5,39\.5 H71\.5 V43 H51\.5 Z/)
  assert.match(androidVector, /M51\.5,46\.5 H71\.5 V50 H51\.5 Z/)
  assert.match(androidVector, /M51\.5,53\.5 H68 V57 H51\.5 Z/)
  assert.match(androidVector, /M51\.5,60 H62 V63 H51\.5 Z/)
  assert.match(androidVector, /android:fillColor="#FF8A24"/)
  assert.match(androidVector, /android:fillColor="#FFD18D"/)
  assert.match(androidVector, /M77,86 L89,98 M89,86 L77,98/)
  assert.match(androidTile, /@drawable\/oanix_launcher_foreground_vector/)
  assert.match(androidLegacy, /@drawable\/oanix_launcher_tile/)
  assert.match(androidForeground, /@drawable\/oanix_launcher_foreground_vector/)
  assert.match(androidAdaptive, /@mipmap\/ic_launcher_foreground/)
})
