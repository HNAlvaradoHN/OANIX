import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const indexSource = readFileSync('index.html', 'utf8')
const mainSource = readFileSync('src/main.tsx', 'utf8')
const pagesWorkflow = readFileSync('.github/workflows/pages.yml', 'utf8')

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

test('Pages deploy verifies the live HTML, CSS and JS shell', () => {
  assert.match(pagesWorkflow, /Verify deployed shell assets/)
  assert.match(pagesWorkflow, /https:\/\/hnalvaradohn\.github\.io\/OANIX\//)
  assert.match(pagesWorkflow, /href="\/OANIX\/assets\/\[\^"\]\+\\\.css"/)
  assert.match(pagesWorkflow, /src="\/OANIX\/assets\/\[\^"\]\+\\\.js"/)
  assert.match(pagesWorkflow, /grep -q '\.vault-shell' \/tmp\/oanix\.css/)
  assert.match(pagesWorkflow, /grep -q 'oanix-v383-visual' \/tmp\/oanix\.js/)
})
