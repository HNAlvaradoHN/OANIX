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

test('fresh PWA shell claims stale clients without forcing an immediate page reload', () => {
  const viteConfig = readFileSync('vite.config.ts', 'utf8')
  const main = readFileSync('src/main.tsx', 'utf8')

  assert.match(viteConfig, /skipWaiting:\s*true/)
  assert.match(viteConfig, /clientsClaim:\s*true/)
  assert.match(main, /serviceWorker\.addEventListener\('controllerchange'/)
  assert.match(main, /let hasPwaController = [^\n]*Boolean\(navigator\.serviceWorker\.controller\)/)
  assert.match(
    main,
    /oanixWindow\.__oanixApplyUpdate = async \(\) => \{\s*window\.location\.reload\(\)\s*\}/,
  )
  assert.equal((main.match(/window\.location\.reload\(\)/g) ?? []).length, 1)
})

test('stylesheet recovery lives in the HTML bootstrap so it survives a broken app bundle cache', () => {
  const index = readFileSync('index.html', 'utf8')
  const main = readFileSync('src/main.tsx', 'utf8')

  assert.match(index, /location\.pathname\.startsWith\('\/OANIX\/'\)/)
  assert.match(index, /oanix:stylesheet-recovery-attempt/)
  assert.match(index, /link\[rel="stylesheet"\]\[href\*="\/OANIX\/assets\/"\]/)
  assert.match(index, /registration\.scope\.includes\('\/OANIX\/'\)/)
  assert.match(index, /cacheKey\.startsWith\('workbox-precache'\)/)
  assert.match(index, /__oanix_retry/)
  assert.match(index, /location\.reload\(\)/)
  assert.equal((index.match(/location\.reload\(\)/g) ?? []).length, 1)
  assert.doesNotMatch(main, /oanix:stylesheet-recovery-attempt/)
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
