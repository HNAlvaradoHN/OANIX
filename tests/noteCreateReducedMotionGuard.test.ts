import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('src/features/notes/noteCreationFeedback.css', 'utf8')

test('note creation feedback stops continuous spinner motion for reduced-motion users', () => {
  assert.match(css, /\.oanix-note-create-feedback__spinner[^\{]*\{[^}]*animation:\s*oanix-note-create-spin\s+\.78s\s+linear\s+infinite/)
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.oanix-note-create-feedback__spinner\s*\{[^}]*animation:\s*none\s*;/)
  assert.doesNotMatch(css, /prefers-reduced-motion:[^}]+animation-duration:\s*1\.8s/)
})
