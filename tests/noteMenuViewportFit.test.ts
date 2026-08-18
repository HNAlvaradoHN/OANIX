import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainSource = readFileSync('src/main.tsx', 'utf8')
const runtimeSource = readFileSync('src/features/notes/NoteMenuViewportFit.tsx', 'utf8')
const fitCss = readFileSync('src/styles/note-menu-viewport-fit.css', 'utf8')

test('note menus measure their real height and flip toward available space', () => {
  assert.match(mainSource, /<NoteMenuViewportFit \/>/)
  assert.match(mainSource, /note-menu-viewport-fit\.css/)
  assert.match(runtimeSource, /menu\.scrollHeight/)
  assert.match(runtimeSource, /spaceBelow/)
  assert.match(runtimeSource, /spaceAbove/)
  assert.match(runtimeSource, /naturalHeight <= spaceBelow/)
  assert.match(runtimeSource, /naturalHeight <= spaceAbove/)
  assert.match(runtimeSource, /spaceAbove > spaceBelow \? 'up' : 'down'/)
})

test('note menus become internally scrollable when neither side fits', () => {
  assert.match(runtimeSource, /--oanix-note-menu-max-height/)
  assert.match(fitCss, /max-height: var\(--oanix-note-menu-max-height/)
  assert.match(fitCss, /overflow-y: auto/)
  assert.match(fitCss, /data-oanix-menu-placement='up'/)
  assert.match(fitCss, /data-oanix-menu-placement='down'/)
})
