import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const icon = readFileSync('public/oanix-icon.svg', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const brandCss = readFileSync('src/styles/web-brand-logo.css', 'utf8')
const androidVector = readFileSync('android/app/src/main/res/drawable/oanix_launcher_foreground_vector.xml', 'utf8')
const androidTile = readFileSync('android/app/src/main/res/drawable/oanix_launcher_tile.xml', 'utf8')
const androidLegacy = readFileSync('android/app/src/main/res/mipmap-anydpi/ic_launcher.xml', 'utf8')
const androidForeground = readFileSync('android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.xml', 'utf8')
const androidAdaptive = readFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'utf8')

test('official OANIX mark keeps the approved black silver copper composition', () => {
  assert.match(icon, /<rect x="20" y="20" width="472" height="472" rx="104" fill="url\(#bg\)"/)
  assert.match(icon, /id="silver"/)
  assert.match(icon, /id="orange"/)
  assert.match(icon, /Logo oficial OANIX sobre negro mate/)
  assert.match(icon, />OANI</)
  assert.match(icon, />X</)
  assert.match(icon, /Copper-orange notepad outline|Copper notebook rulings/)
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

test('Android launcher mirrors the official identity inside the adaptive safe zone', () => {
  assert.match(androidVector, /android:scaleX="0\.78"/)
  assert.match(androidVector, /#BFC2C7/)
  assert.match(androidVector, /#E88732/)
  assert.match(androidVector, /M77,86 L89,98 M89,86 L77,98/)
  assert.match(androidTile, /@drawable\/oanix_launcher_foreground_vector/)
  assert.match(androidLegacy, /@drawable\/oanix_launcher_tile/)
  assert.match(androidForeground, /@drawable\/oanix_launcher_foreground_vector/)
  assert.match(androidAdaptive, /@mipmap\/ic_launcher_foreground/)
})
