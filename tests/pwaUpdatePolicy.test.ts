import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('PWA updates never auto-reload the vault password screen', () => {
  const viteConfig = readFileSync('vite.config.ts', 'utf8')
  const main = readFileSync('src/main.tsx', 'utf8')
  assert.match(viteConfig, /registerType:\s*'prompt'/)
  assert.doesNotMatch(viteConfig, /registerType:\s*'autoUpdate'/)
  assert.match(main, /registerSW\(\{ immediate: false \}\)/)
  assert.doesNotMatch(main, /registerSW\(\{ immediate: true \}\)/)
})

test('PWA keeps the executable app shell available offline', () => {
  const viteConfig = readFileSync('vite.config.ts', 'utf8')

  assert.match(viteConfig, /globPatterns:\s*\['\*\*\/\*\.\{js,css,html,wasm\}'\]/)
  assert.match(viteConfig, /navigateFallback:\s*'index\.html'/)
  assert.match(viteConfig, /cleanupOutdatedCaches:\s*true/)
  assert.match(viteConfig, /includeAssets:\s*\['oanix-icon\.svg'\]/)
  assert.match(viteConfig, /start_url:\s*'\/OANIX\/'/)
  assert.match(viteConfig, /scope:\s*'\/OANIX\/'/)
})
