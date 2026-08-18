import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const noteTypes = readFileSync('src/features/notes/noteTypes.ts', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const nativeShare = readFileSync('src/platform/android/NativeNoteShareRuntime.tsx', 'utf8')

test('note list secondary text exposes only the current daily-entry title', () => {
  assert.match(workspace, /function notePreview\(note: NoteRecord\): string \{[\s\S]*noteBlocksToPlainText\(note\.content\.blocks\)/)
  assert.match(noteTypes, /export function noteBlocksToPlainText\(blocks: StoredNoteBlock\[\]\): string \{[\s\S]*reverse\(\)\.find\(\(block\) => block\.type === 'dailyEntry'\)[\s\S]*latestEntry\.title\.trim\(\)/)
})

test('full note body remains available only for an explicit share action', () => {
  assert.match(noteTypes, /export function noteBlocksToFullPlainText/)
  assert.match(nativeShare, /noteBlocksToFullPlainText\(note\.content\.blocks\)/)
  assert.doesNotMatch(nativeShare, /noteBlocksToPlainText\(note\.content\.blocks\)/)
})

test('list-safe helper does not derive a preview from body, contact, code or image content', () => {
  const safeStart = noteTypes.indexOf('export function noteBlocksToPlainText')
  const fullStart = noteTypes.indexOf('export function noteBlocksToFullPlainText')
  assert.ok(safeStart >= 0 && fullStart > safeStart)
  const safeBody = noteTypes.slice(safeStart, fullStart)

  assert.doesNotMatch(safeBody, /paragraph|contact|code|image|checklist|runsToPlainText|block\.text|block\.name|block\.alt/)
  assert.match(safeBody, /dailyEntry/)
  assert.match(safeBody, /title\.trim\(\)/)
})
