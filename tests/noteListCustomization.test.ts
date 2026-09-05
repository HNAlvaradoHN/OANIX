import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const appSource = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
const listSource = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')
const listCss = readFileSync('src/features/rebuild/noteListSection.css', 'utf8')

test('note list customization source remains available', () => {
  assert.match(appSource, /RebuildApp/)
  assert.match(listSource, /NoteListSection/)
  assert.match(listCss, /rebuild-note/)
})
