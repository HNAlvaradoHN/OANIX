import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const refinements = readFileSync('src/features/notes/workspaceRefinements.css', 'utf8')
const compactContract = readFileSync('src/features/notes/compactNoteContract.css', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

test('mobile note list has one compact geometry authority', () => {
  assert.doesNotMatch(refinements, /@media \(max-width: 760px\)/)
  assert.match(compactContract, /@media \(max-width: 760px\)/)
  assert.match(compactContract, /\.note-row:not\(\.note-row--selected\):not\(\.note-row--menu-open\)\s*\{[\s\S]*?min-height:\s*72px !important/)
  assert.match(compactContract, /margin:\s*8px 0 0 !important/)
  assert.match(compactContract, /\.note-row:not\(\.note-row--selected\):not\(\.note-row--menu-open\)::before[\s\S]*?display:\s*none !important/)
  assert.match(compactContract, /padding:\s*12px clamp\(160px, 44vw, 230px\) 10px 64px !important/)
  assert.match(compactContract, /left:\s*14px !important/)
  assert.match(compactContract, /top:\s*50% !important/)
  assert.match(compactContract, /-webkit-line-clamp:\s*1 !important/)
})

test('opening the note action menu no longer restores the expanded v38.3 card', () => {
  assert.match(workspace, /noteMenuId === note\.id \? ' note-row--menu-open' : ''/)
  assert.match(compactContract, /\.note-row\.note-row--menu-open:not\(\.note-row--selected\)\s*\{[\s\S]*?min-height:\s*72px !important/)
  assert.match(compactContract, /\.note-row\.note-row--menu-open:not\(\.note-row--selected\) \.note-row__open\s*\{[\s\S]*?min-height:\s*72px !important/)
  assert.match(compactContract, /\.note-row\.note-row--menu-open:not\(\.note-row--selected\) \.note-row__avatar\[data-oanix-note-icon\][\s\S]*?width:\s*36px !important/)
  assert.match(compactContract, /\.note-row\.note-row--menu-open:not\(\.note-row--selected\) \.note-row__menu-wrap[\s\S]*?top:\s*22px !important/)
})
