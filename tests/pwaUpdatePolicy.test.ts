import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('PWA updates never auto-reload the vault password screen', () => {
  const viteConfig = readFileSync('vite.config.ts', 'utf8')
  const main = readFileSync('src/main.tsx', 'utf8')

  assert.match(viteConfig, /registerType:\s*'prompt'/)
  assert.doesNotMatch(viteConfig, /registerType:\s*'autoUpdate'/)
  assert.match(main, /registerSW\(\{[\s\S]*?immediate:\s*false/)
  assert.match(main, /onNeedRefresh/)
  assert.match(main, /oanix:update-available/)
  assert.match(main, /updateSW\(true\)/)
  assert.doesNotMatch(main, /immediate:\s*true/)

  const registrationBlock = main.match(/const updateSW = registerSW\(\{[\s\S]*?\n  \}\)/)?.[0] ?? ''
  assert.ok(registrationBlock, 'missing prompt-based PWA registration block')
  assert.doesNotMatch(registrationBlock, /window\.location\.reload\(|location\.reload\(/)
})

test('stylesheet recovery reload is isolated from normal PWA updates', () => {
  const main = readFileSync('src/main.tsx', 'utf8')
  const recoveryBlock = main.match(/async function clearOanixPrecacheAndReload\(\): Promise<void> \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.ok(recoveryBlock, 'missing stylesheet recovery fallback')
  assert.match(recoveryBlock, /!navigator\.onLine/)
  assert.match(recoveryBlock, /STYLESHEET_RECOVERY_KEY/)
  assert.match(recoveryBlock, /registration\.scope\.includes\('\/OANIX\/'\)/)
  assert.match(recoveryBlock, /cacheKey\.startsWith\('workbox-precache'\)/)
  assert.match(recoveryBlock, /window\.location\.reload\(\)/)
  assert.equal((main.match(/window\.location\.reload\(\)/g) ?? []).length, 1)
})

test('PWA keeps the executable app shell available offline', () => {
  const viteConfig = readFileSync('vite.config.ts', 'utf8')

  assert.match(viteConfig, /globPatterns:\s*\['\*\*\/\*\.\{js,css,html,wasm\}'\]/)
  assert.match(viteConfig, /navigateFallback:\s*'index\.html'/)
  assert.match(viteConfig, /cleanupOutdatedCaches:\s*true/)
  assert.match(viteConfig, /includeAssets:\s*\[[^\]]*'oanix-icon\.svg'[^\]]*\]/)
  assert.match(viteConfig, /includeAssets:\s*\[[^\]]*'oanix-logo\.webp'[^\]]*\]/)
  assert.match(viteConfig, /start_url:\s*'\/OANIX\/'/)
  assert.match(viteConfig, /scope:\s*'\/OANIX\/'/)
})
