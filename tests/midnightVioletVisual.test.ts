import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const themeVisualStyles = readFileSync('src/app/ThemeVisualStyles.ts', 'utf8')
const authority = readFileSync('src/styles/midnight-violet.css', 'utf8')
const foundation = readFileSync('src/styles/midnight-violet-foundation.css', 'utf8')
const surfaces = readFileSync('src/styles/midnight-violet-surfaces.css', 'utf8')
const themeSurfaces = readFileSync('src/styles/theme-surfaces.css', 'utf8')
const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const avatarService = readFileSync('src/features/notes/noteAvatarService.ts', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const gate = readFileSync('src/app/VaultGate.tsx', 'utf8')

test('Midnight Violet has one public CSS authority with stable internal order', () => {
  assert.match(main, /\.\/app\/ThemeVisualStyles/)
  assert.match(themeVisualStyles, /styles\/midnight-violet\.css/)
  assert.doesNotMatch(main, /styles\/midnight-violet\.css/)
  assert.doesNotMatch(main, /styles\/redesign\.css/)
  assert.doesNotMatch(main, /styles\/redesign-polish\.css/)

  const foundationIndex = authority.indexOf("@import './midnight-violet-foundation.css'")
  const surfacesIndex = authority.indexOf("@import './midnight-violet-surfaces.css'")
  assert.ok(foundationIndex >= 0 && surfacesIndex > foundationIndex)
})

test('Midnight Violet remains the semantic baseline while personalization may restore another preset', () => {
  assert.match(main, /applyOanixTheme\(readSavedOanixTheme\(\), false\)/)
  assert.match(themeVisualStyles, /styles\/theme-surfaces\.css/)
  assert.doesNotMatch(main, /styles\/themes\.css/)
  assert.match(foundation, /:root\[data-oanix-theme='midnight-violet'\]/)
  assert.match(themeSurfaces, /:root\[data-oanix-theme='midnight-violet'\]/)
  assert.match(themeSurfaces, /--theme-accent:/)
  assert.match(themeSurfaces, /--theme-border:/)
  assert.match(themeSurfaces, /--theme-glow:/)
})

test('headline and title typography explicitly protect descenders from clipping', () => {
  assert.match(foundation, /\.vault-title[\s\S]*line-height:[^;]+!important/)
  assert.match(foundation, /\.vault-title[\s\S]*padding:[^;]+!important/)
  assert.match(foundation, /\.note-title-field input[\s\S]*padding-block:/)
})

test('existing OANIX marks receive the technological nucleus/orbit treatment', () => {
  assert.match(foundation, /\.vault-logo,[\s\S]*\.notes-brand__mark/)
  assert.match(foundation, /oanixBrandOrbit/)
  assert.match(foundation, /prefers-reduced-motion/)
})

test('note avatars remain encrypted visuals but the list avatar is a passive reorder handle', () => {
  assert.match(avatar, /readNoteAvatar/)
  assert.match(avatar, /loadNoteAvatarPreview/)
  assert.match(avatar, /title="Mantén pulsado para reordenar"/)
  assert.match(avatar, /URL\.createObjectURL/)
  assert.match(avatar, /URL\.revokeObjectURL/)
  assert.doesNotMatch(avatar, /chooseNoteAvatar|input\.type = 'file'|onClick=|onPointerDown=|createPortal|stopPropagation/)
  assert.doesNotMatch(avatar, /block\.type === 'image'/)
  assert.match(avatarService, /NOTE_AVATAR_RECORD_TYPE = 'note-avatar'/)
  assert.match(avatarService, /storeEncryptedImage/)
  assert.match(workspace, /<NoteAvatar note=\{note\} className="note-row__avatar"/)
  assert.doesNotMatch(workspace, /<NoteAvatar note=\{selectedNote\} className="note-view__avatar"/)
  assert.match(workspace, /<AuroraNoteSheet/)
})

test('notes use separated premium cards while preserving list-safe secondary text', () => {
  assert.match(foundation, /\.note-row[\s\S]*border-radius:/)
  assert.match(foundation, /\.note-row::before/)
  assert.match(workspace, /noteBlocksToPlainText\(note\.content\.blocks\)/)
})

test('surface refinements keep menu stacking and long labels inside cards', () => {
  assert.match(surfaces, /\.note-row:hover\s*\{\s*z-index:\s*2/)
  assert.match(surfaces, /\.note-row--menu-open\s*\{\s*z-index:\s*120/)
  assert.match(surfaces, /\.note-row__menu\s*\{\s*z-index:\s*130/)
  assert.match(surfaces, /\.note-row__topline strong,[\s\S]*text-overflow:\s*ellipsis/)
  assert.match(surfaces, /\.note-view__identity strong[\s\S]*white-space:\s*nowrap/)
  assert.match(surfaces, /\.note-row__preview[\s\S]*text-overflow:\s*ellipsis/)
})

test('Midnight Violet remains dark while graphite and navy dominate surfaces', () => {
  assert.match(surfaces, /--oanix-bg:\s*#0a0f18/)
  assert.match(surfaces, /linear-gradient\(170deg, #121927, #0b111b\)/)
  assert.match(surfaces, /--oanix-accent:\s*#8d7aff/)
})

test('Google account label remains session-driven and no personal email is hardcoded', () => {
  assert.match(gate, /onlineSession\?\.email/)
  assert.doesNotMatch(gate, /geovaalvarado0@gmail\.com/i)
  assert.doesNotMatch(foundation, /geovaalvarado0@gmail\.com/i)
  assert.doesNotMatch(surfaces, /geovaalvarado0@gmail\.com/i)
  assert.doesNotMatch(themeSurfaces, /geovaalvarado0@gmail\.com/i)
})
