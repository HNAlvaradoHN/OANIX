import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const dismiss = readFileSync('src/features/notes/NoteMenuScrollDismiss.tsx', 'utf8')

test('open note action menu closes when the note list starts scrolling or touch-scrolling', () => {
  assert.doesNotMatch(main, /NoteMenuScrollDismiss/)
  assert.match(legacyGate, /<NoteMenuScrollDismiss\s*\/>/)
  assert.match(dismiss, /\.note-row__menu-button\[aria-expanded="true"\]/)
  assert.match(dismiss, /closest\('\.notes-list'\)/)
  assert.match(dismiss, /addEventListener\('scroll',[\s\S]*true\)/)
  assert.match(dismiss, /addEventListener\('touchmove',[\s\S]*passive: true/)
  assert.match(dismiss, /openButton\?\.click\(\)/)
})
