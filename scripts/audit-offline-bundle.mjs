import { readFileSync, readdirSync } from 'node:fs'

const sw = readFileSync('dist/sw.js', 'utf8')
const precached = new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]))
const executableAssets = readdirSync('dist/assets')
  .filter((name) => /\.(?:js|css|wasm)$/.test(name))
  .map((name) => `assets/${name}`)

for (const asset of executableAssets) {
  if (!precached.has(asset)) {
    throw new Error(`Offline precache is missing ${asset}`)
  }
}

for (const required of ['index.html', 'oanix-icon.svg', 'manifest.webmanifest']) {
  if (!precached.has(required)) {
    throw new Error(`Offline precache is missing ${required}`)
  }
}

if (!sw.includes('cleanupOutdatedCaches()')) {
  throw new Error('Generated service worker is not cleaning outdated caches')
}
if (!sw.includes('createHandlerBoundToURL("index.html")')) {
  throw new Error('Generated service worker has no index.html navigation fallback')
}
