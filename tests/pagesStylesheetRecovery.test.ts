import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainSource = readFileSync('src/main.tsx', 'utf8')
const pagesWorkflow = readFileSync('.github/workflows/pages.yml', 'utf8')

test('PWA retries a missing hashed stylesheet and only then clears OANIX precache', () => {
  assert.match(mainSource, /STYLESHEET_RECOVERY_KEY/)
  assert.match(mainSource, /link\[rel="stylesheet"\]\[href\*="\/OANIX\/assets\/"\]/)
  assert.match(mainSource, /__oanix_retry/)
  assert.match(mainSource, /navigator\.serviceWorker\.getRegistrations\(\)/)
  assert.match(mainSource, /registration\.scope\.includes\('\/OANIX\/'\)/)
  assert.match(mainSource, /cacheKey\.startsWith\('workbox-precache'\)/)
  assert.match(mainSource, /window\.addEventListener\('load', \(\) => void recoverMissingPwaStylesheet\(\), \{ once: true \}\)/)
})

test('Pages deploy verifies the live HTML, CSS and JS shell', () => {
  assert.match(pagesWorkflow, /Verify deployed shell assets/)
  assert.match(pagesWorkflow, /https:\/\/hnalvaradohn\.github\.io\/OANIX\//)
  assert.match(pagesWorkflow, /href="\/OANIX\/assets\/\[\^"\]\+\\\.css"/)
  assert.match(pagesWorkflow, /src="\/OANIX\/assets\/\[\^"\]\+\\\.js"/)
  assert.match(pagesWorkflow, /grep -q '\.vault-shell' \/tmp\/oanix\.css/)
  assert.match(pagesWorkflow, /grep -q 'oanix-v383-visual' \/tmp\/oanix\.js/)
})
