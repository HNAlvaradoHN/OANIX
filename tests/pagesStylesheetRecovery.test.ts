import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const indexSource = readFileSync('index.html', 'utf8')
const mainSource = readFileSync('src/main.tsx', 'utf8')
const pagesWorkflow = readFileSync('.github/workflows/pages.yml', 'utf8')
const pagesVerifier = readFileSync('scripts/verify-pages-deployment.mjs', 'utf8')

test('PWA retries a missing hashed stylesheet from the HTML bootstrap before clearing OANIX precache', () => {
  assert.match(indexSource, /oanix:stylesheet-recovery-attempt/)
  assert.match(indexSource, /link\[rel="stylesheet"\]\[href\*="\/OANIX\/assets\/"\]/)
  assert.match(indexSource, /__oanix_retry/)
  assert.match(indexSource, /navigator\.serviceWorker\.getRegistrations\(\)/)
  assert.match(indexSource, /registration\.scope\.includes\('\/OANIX\/'\)/)
  assert.match(indexSource, /cacheKey\.startsWith\('workbox-precache'\)/)
  assert.match(indexSource, /window\.addEventListener\('load', recoverStylesheet, \{ once: true \}\)/)
  assert.doesNotMatch(mainSource, /oanix:stylesheet-recovery-attempt/)
})

test('Pages deploy delegates to one versioned live HTML, CSS and JS shell verifier', () => {
  assert.match(pagesWorkflow, /deploy:[\s\S]*Checkout verifier source[\s\S]*actions\/checkout@v4/)
  assert.match(pagesWorkflow, /deploy:[\s\S]*Setup Node\.js[\s\S]*node-version-file:\s*\.nvmrc/)
  assert.match(pagesWorkflow, /Verify deployed shell assets/)
  assert.match(pagesWorkflow, /npm run verify:pages/)
  assert.doesNotMatch(pagesWorkflow, /https:\/\/hnalvaradohn\.github\.io\/OANIX\//)

  assert.match(pagesVerifier, /https:\/\/hnalvaradohn\.github\.io\/OANIX\//)
  assert.match(pagesVerifier, /\/OANIX\\\/assets\\\/\[\^"\]\+\\\.css/)
  assert.match(pagesVerifier, /\/OANIX\\\/assets\\\/\[\^"\]\+\\\.js/)
  assert.match(pagesVerifier, /Buffer\.byteLength\(css\) <= 10000/)
  assert.match(pagesVerifier, /Buffer\.byteLength\(js\) <= 10000/)
  assert.match(pagesVerifier, /css\.includes\('\.vault-shell'\)/)
  assert.match(pagesVerifier, /js\.includes\('data-oanix-workspace-v2'\)/)
  assert.match(pagesVerifier, /const RETRIES = 8/)
})
