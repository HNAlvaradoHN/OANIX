import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtimeSource = readFileSync('src/features/privacy/NotePrivacyRuntime.tsx', 'utf8')
const styleSource = readFileSync('src/features/privacy/manualNoteRelock.css', 'utf8')

test('protected note can be manually relocked without changing stored privacy metadata', () => {
  assert.match(runtimeSource, /function manuallyRelockNote\(noteId: string\)/)
  assert.match(runtimeSource, /next\.delete\(noteId\)/)
  assert.match(runtimeSource, /className=\{`oanix-note-session-lock/)
  assert.match(runtimeSource, /Bloquear esta nota ahora/)
  assert.match(runtimeSource, /Desbloquear esta nota/)
  assert.match(runtimeSource, /openLockDialog\('unlock', selectedNoteId\)/)
  assert.match(runtimeSource, /unlockedNoteIds\.has\(selectedNoteId\) \? '🔓' : '🔒'/)

  const relockBody = runtimeSource.match(/function manuallyRelockNote[\s\S]*?(?=\n  function openLockDialog)/)?.[0] ?? ''
  assert.ok(relockBody.length > 0)
  assert.doesNotMatch(relockBody, /setNotePrivacyLock|setNotePrivateBox|createNotePrivacyLock/)
})

test('manual note lock control follows the active theme and replaces duplicate pseudo lock', () => {
  assert.match(runtimeSource, /import '\.\/manualNoteRelock\.css'/)
  assert.match(runtimeSource, /dataset\.oanixNoteHasLock/)
  assert.match(styleSource, /data-oanix-note-has-lock='true'/)
  assert.match(styleSource, /\.oanix-note-session-lock/)
  assert.match(styleSource, /var\(--theme-accent/)
})
