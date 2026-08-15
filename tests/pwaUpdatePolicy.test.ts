import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('PWA updates never auto-reload the vault password screen', () => {
  const viteConfig = readFileSync('vite.config.ts', 'utf8')
  const main = readFileSync('src/main.tsx', 'utf8')
  assert.match(viteConfig, /registerType:\s*'prompt'/)
  assert.doesNotMatch(viteConfig, /registerType:\s*'autoUpdate'/)
  assert.match(main, /registerSW\(\{ immediate: false \}\)/)
})
