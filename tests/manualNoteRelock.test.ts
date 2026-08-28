import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtimeSource = readFileSync('src/features/privacy/NotePrivacyRuntime.tsx', 'utf8')
const styleSource = readFileSync('src/features/privacy/manualNoteRelock.css', 'utf8')
const notesStyleSource = readFileSync('src/features/notes/notes.css', 'utf8')

test('protected note session lock lives in the note row and reuses the existing in-memory unlock set', () => {
  assert.match(runtimeSource, /const rowPrivacyHosts = useMemo/)
  assert.match(runtimeSource, /\.note-row\[data-reorder-note-id\]/)
  assert.match(runtimeSource, /if \(!privacy\?\.lock\) return null/)
  assert.match(runtimeSource, /const isUnlocked = unlockedNoteIds\.has\(noteId\)/)
  assert.match(runtimeSource, /className=\{`oanix-note-row-lock/)
  assert.match(runtimeSource, /Bloquear esta nota ahora/)
  assert.match(runtimeSource, /Desbloquear esta nota/)
  assert.doesNotMatch(runtimeSource, /className=\{`oanix-note-session-lock/)
})

test('workspace v2 mounts the lock inside the existing note action row instead of over metadata', () => {
  assert.match(runtimeSource, /row\.querySelector<HTMLElement>\('\[data-v2-note-actions="true"\]'\)/)
  assert.match(runtimeSource, /inV2Actions: Boolean\(actionHost\)/)
  assert.match(runtimeSource, /oanix-note-row-lock--v2-action/)
})

test('row lock click cannot accidentally open the note and locked state uses the existing dialog', () => {
  assert.match(runtimeSource, /event\.preventDefault\(\)/)
  assert.match(runtimeSource, /event\.stopPropagation\(\)/)
  assert.match(runtimeSource, /manuallyRelockNote\(noteId\)/)
  assert.match(runtimeSource, /openLockDialog\('unlock', noteId\)/)
})

test('manual relock only clears ephemeral authorization and only blurs the selected note editor', () => {
  const relockBody = runtimeSource.match(/function manuallyRelockNote[\s\S]*?(?=\n  function openLockDialog)/)?.[0] ?? ''
  assert.ok(relockBody.length > 0)
  assert.match(relockBody, /selectedNoteIdFromDom\(\) === noteId/)
  assert.match(relockBody, /next\.delete\(noteId\)/)
  assert.doesNotMatch(relockBody, /setNotePrivacyLock|setNotePrivateBox|createNotePrivacyLock|localStorage|sessionStorage/)
})

test('explicit row lock replaces duplicate pseudo locks and keeps list title ellipsis intact', () => {
  assert.match(runtimeSource, /dataset\.oanixNoteHasLock/)
  assert.match(styleSource, /note-row\[data-oanix-note-has-lock='true'\]/)
  assert.match(styleSource, /\.oanix-note-row-lock/)
  assert.match(styleSource, /flex: 0 0 auto/)
  assert.match(styleSource, /var\(--theme-accent/)
  assert.match(styleSource, /max-width: 360px[\s\S]*?note-row__topline time[\s\S]*?display: none/)
  assert.match(styleSource, /prefers-reduced-motion/)
  assert.match(notesStyleSource, /\.note-row__open[\s\S]*?min-width: 0/)
  assert.match(notesStyleSource, /\.note-row__topline strong[^}]*overflow: hidden[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/)
  assert.match(notesStyleSource, /\.note-row__topline time \{ flex: 0 0 auto/)
})
