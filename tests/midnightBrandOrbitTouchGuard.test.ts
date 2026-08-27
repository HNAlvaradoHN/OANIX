import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const authority = readFileSync('src/styles/midnight-violet.css', 'utf8')
const foundation = readFileSync('src/styles/midnight-violet-foundation.css', 'utf8')

test('midnight brand orbit keeps desktop motion but stops continuous animation on coarse pointers', () => {
  assert.match(foundation, /animation:\s*oanixBrandOrbit\s+10s\s+linear\s+infinite/)
  assert.match(authority, /@media \(pointer: coarse\)/)
  assert.match(authority, /\.vault-logo::before,[\s\S]*\.notes-brand__mark::before,[\s\S]*\.note-view__empty-mark::before[\s\S]*animation:\s*none\s*!important/)
})
