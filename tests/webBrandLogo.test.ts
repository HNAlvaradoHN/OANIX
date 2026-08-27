import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const icon = readFileSync('public/oanix-icon.svg', 'utf8')
const pwaLogo = readFileSync('public/oanix-logo.webp')
const main = readFileSync('src/main.tsx', 'utf8')
const brandCss = readFileSync('src/styles/web-brand-logo.css', 'utf8')
const viteConfig = readFileSync('vite.config.ts', 'utf8')
const androidVector = readFileSync('android/app/src/main/res/drawable/oanix_launcher_foreground_vector.xml', 'utf8')
const androidTile = readFileSync('android/app/src/main/res/drawable/oanix_launcher_tile.xml', 'utf8')
const androidLegacy = readFileSync('android/app/src/main/res/mipmap-anydpi/ic_launcher.xml', 'utf8')
const androidForeground = readFileSync('android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.xml', 'utf8')
const androidAdaptive = readFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'utf8')

test('current Android identity remains untouched while PWA branding changes', () => {
  assert.match(icon, /C blanca plateada con destello/)
  assert.match(icon, /Bright orange note rulings/)
  assert.match(icon, />OANI</)
  assert.match(icon, />X</)
})

test('PWA selected logo is stored as a real WebP raster asset', () => {
  assert.equal(pwaLogo.subarray(0, 4).toString('ascii'), 'RIFF')
  assert.equal(pwaLogo.subarray(8, 12).toString('ascii'), 'WEBP')
  assert.ok(pwaLogo.length > 8_000)
})

test('PWA uses the selected logo while Capacitor keeps the current icon', () => {
  assert.match(main, /const isCapacitorBuild = import\.meta\.env\.MODE === 'capacitor'/)
  assert.match(main, /isCapacitorBuild \? 'oanix-icon\.svg' : 'oanix-logo\.webp'/)
  assert.match(main, /classList\.add\('oanix-brand-pwa-preview'\)/)
  assert.match(main, /import\.meta\.env\.BASE_URL/)
  assert.match(brandCss, /html\.oanix-brand-pwa-preview \.notes-brand__mark/)
  assert.match(brandCss, /background-size: 94% 94% !important/)
  assert.match(brandCss, /background-image: var\(--oanix-brand-logo-url\) !important/)
})

test('PWA brand stays visually stable without continuous idle motion', () => {
  assert.doesNotMatch(brandCss, /oanix-brand-float/)
  assert.doesNotMatch(brandCss, /oanix-brand-sheen/)
  assert.doesNotMatch(brandCss, /animation:[^;]*infinite/)
  assert.match(brandCss, /oanix-brand-pwa-preview[\s\S]*will-change:\s*auto/)
})

test('PWA manifest uses the selected logo without changing Android resources', () => {
  assert.match(viteConfig, /includeAssets: \['oanix-icon\.svg', 'oanix-logo\.webp'\]/)
  assert.match(viteConfig, /src: '\/OANIX\/oanix-logo\.webp'/)
  assert.match(viteConfig, /sizes: '512x512'/)
  assert.match(viteConfig, /type: 'image\/webp'/)
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
