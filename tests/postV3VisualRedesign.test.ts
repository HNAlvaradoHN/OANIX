import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const redesign = readFileSync('src/styles/redesign.css', 'utf8')
const themes = readFileSync('src/styles/themes.css', 'utf8')
const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const gate = readFileSync('src/app/VaultGate.tsx', 'utf8')

test('Midnight Violet remains the semantic baseline while personalization may restore another preset', () => {
  assert.match(main, /applyOanixTheme\(readSavedOanixTheme\(\), false\)/)
  assert.match(main, /styles\/redesign\.css/)
  assert.match(main, /styles\/themes\.css/)
  assert.match(redesign, /:root\[data-oanix-theme='midnight-violet'\]/)
  assert.match(themes, /:root\[data-oanix-theme='midnight-violet'\]/)
  assert.match(themes, /--theme-accent:/)
  assert.match(themes, /--theme-border:/)
  assert.match(themes, /--theme-glow:/)
})

test('headline and title typography explicitly protect descenders from clipping', () => {
  assert.match(redesign, /\.vault-title[\s\S]*line-height:[^;]+!important/)
  assert.match(redesign, /\.vault-title[\s\S]*padding:[^;]+!important/)
  assert.match(redesign, /\.note-title-field input[\s\S]*padding-block:/)
})

test('existing OANIX marks receive the technological nucleus/orbit treatment', () => {
  assert.match(redesign, /\.vault-logo,[\s\S]*\.notes-brand__mark/)
  assert.match(redesign, /oanixBrandOrbit/)
  assert.match(redesign, /prefers-reduced-motion/)
})

test('note avatars reuse encrypted note images and revoke temporary blob URLs', () => {
  assert.match(avatar, /loadEncryptedImagePreview/)
  assert.match(avatar, /block\.type === 'image'/)
  assert.match(avatar, /URL\.createObjectURL/)
  assert.match(avatar, /URL\.revokeObjectURL/)
  assert.match(workspace, /<NoteAvatar note=\{note\} className="note-row__avatar"/)
  assert.match(workspace, /<NoteAvatar note=\{selectedNote\} className="note-view__avatar"/)
})

test('notes use separated premium cards while preserving list-safe secondary text', () => {
  assert.match(redesign, /\.note-row[\s\S]*border-radius:/)
  assert.match(redesign, /\.note-row::before/)
  assert.match(workspace, /noteBlocksToPlainText\(note\.content\.blocks\)/)
})

test('Google account label remains session-driven and no personal email is hardcoded', () => {
  assert.match(gate, /onlineSession\?\.email/)
  assert.doesNotMatch(gate, /geovaalvarado0@gmail\.com/i)
  assert.doesNotMatch(redesign, /geovaalvarado0@gmail\.com/i)
  assert.doesNotMatch(themes, /geovaalvarado0@gmail\.com/i)
})
