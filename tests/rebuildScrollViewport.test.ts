import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Home constrains the shell and main viewport so the note list owns vertical scrolling', () => {
  const css = readFileSync('src/features/rebuild/rebuild.css', 'utf8')

  assert.match(
    css,
    /\.rebuild-shell\s*\{[\s\S]*?min-height:\s*100dvh;[\s\S]*?height:\s*100dvh;[\s\S]*?overflow:\s*hidden;/,
  )
  assert.match(
    css,
    /\.rebuild-main\s*\{[\s\S]*?min-height:\s*100dvh;[\s\S]*?height:\s*100dvh;[\s\S]*?overflow:\s*hidden;/,
  )
  assert.match(
    css,
    /\.rebuild-notes\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/,
  )
})
