import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const polish = readFileSync('src/styles/redesign-polish.css', 'utf8')

test('post-redesign polish is loaded after the base redesign', () => {
  assert.match(main, /styles\/redesign\.css[\s\S]*styles\/redesign-polish\.css/)
})

test('open note menu outranks transformed sibling cards', () => {
  assert.match(polish, /\.note-row:hover\s*\{\s*z-index:\s*2/)
  assert.match(polish, /\.note-row--menu-open\s*\{\s*z-index:\s*120/)
  assert.match(polish, /\.note-row__menu\s*\{\s*z-index:\s*130/)
})

test('long note labels stay inside cards and headers with ellipsis', () => {
  assert.match(polish, /\.note-row__topline strong,[\s\S]*text-overflow:\s*ellipsis/)
  assert.match(polish, /\.note-view__identity strong[\s\S]*white-space:\s*nowrap/)
  assert.match(polish, /\.note-row__preview[\s\S]*text-overflow:\s*ellipsis/)
})

test('Midnight Violet remains dark while graphite and navy dominate surfaces', () => {
  assert.match(polish, /--oanix-bg:\s*#0a0f18/)
  assert.match(polish, /linear-gradient\(170deg, #121927, #0b111b\)/)
  assert.match(polish, /--oanix-accent:\s*#8d7aff/)
})
