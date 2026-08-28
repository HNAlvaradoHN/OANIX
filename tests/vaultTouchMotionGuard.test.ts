import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const authority = readFileSync('src/app/VaultVisualStyles.ts', 'utf8')
const guard = readFileSync('src/styles/vault-touch-motion-guard.css', 'utf8')
const globalCss = readFileSync('src/styles/global.css', 'utf8')

test('vault touch guard disables only ambient continuous motion on coarse pointers', () => {
  assert.doesNotMatch(main, /styles\/vault-touch-motion-guard\.css/)
  assert.match(main, /app\/VaultVisualStyles/)
  assert.match(authority, /vault-touch-motion-guard\.css/)
  assert.match(guard, /@media \(pointer: coarse\)/)
  assert.match(guard, /\.vault-shell::after/)
  assert.match(guard, /\.vault-glow/)
  assert.match(guard, /\.vault-core__ring--outer/)
  assert.match(guard, /\.vault-core__ring--middle/)
  assert.match(guard, /\.vault-core__scan/)
  assert.match(guard, /animation:\s*none\s*!important/)
  assert.doesNotMatch(guard, /\.vault-loader/)
  assert.match(globalCss, /\.vault-loader[^\{]*\{[^}]*animation:\s*vaultOrbit\s+\.9s\s+linear\s+infinite/)
})
