import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('folder overflow uses dedicated click arrows without covering folder tabs', () => {
  const source = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
  const css = readFileSync('src/features/notes/notes.css', 'utf8')

  assert.doesNotMatch(source, /Desliza/)
  assert.match(source, /Ver carpetas anteriores/)
  assert.match(source, /Ver carpetas siguientes/)
  assert.match(source, /tabs\.scrollBy/)
  assert.match(css, /grid-template-columns:\s*2\.35rem minmax\(0, 1fr\) 2\.35rem/)
  assert.match(css, /notes-tabs-scroll-button:disabled/)
})
