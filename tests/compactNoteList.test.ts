import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const refinements = readFileSync('src/features/notes/workspaceRefinements.css', 'utf8')
const compactContract = readFileSync('src/features/notes/compactNoteContract.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

test('mobile note list stays compact in its normal state', () => {
  assert.match(refinements, /@media \(max-width: 760px\)/)
  assert.match(refinements, /\.notes-shell:not\(\.notes-shell--searching\) \.note-row:not\(\.note-row--selected\):not\(\.note-row--menu-open\)/)
  assert.match(refinements, /min-height:\s*72px !important/)
  assert.match(refinements, /margin:\s*8px 0 0 !important/)
  assert.match(refinements, /\.note-row:not\(\.note-row--selected\):not\(\.note-row--menu-open\)::before[\s\S]*?display:\s*none !important/)
  assert.match(refinements, /left:\s*13px !important/)
  assert.match(refinements, /top:\s*50% !important/)
  assert.match(refinements, /-webkit-line-clamp:\s*1 !important/)
})

test('opening the note action menu no longer restores the expanded v38.3 card', () => {
  assert.match(workspace, /noteMenuId === note\.id \? ' note-row--menu-open' : ''/)
  assert.match(compactContract, /\.note-row\.note-row--menu-open:not\(\.note-row--selected\)\s*\{[\s\S]*?min-height:\s*72px !important/)
  assert.match(compactContract, /\.note-row\.note-row--menu-open:not\(\.note-row--selected\) \.note-row__open\s*\{[\s\S]*?min-height:\s*72px !important/)
  assert.match(compactContract, /\.note-row\.note-row--menu-open:not\(\.note-row--selected\) \.note-row__avatar\[data-oanix-note-icon\][\s\S]*?width:\s*36px !important/)
  assert.match(compactContract, /\.note-row\.note-row--menu-open:not\(\.note-row--selected\) \.note-row__menu-wrap[\s\S]*?top:\s*22px !important/)
})
