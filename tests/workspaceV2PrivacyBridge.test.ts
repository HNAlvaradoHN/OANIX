import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sidebar = readFileSync('src/features/notes/themes/infographic/InfographicWorkspace.tsx', 'utf8')
const privacy = readFileSync('src/features/privacy/NotePrivacyRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/themes/infographic/infographicTheme.css', 'utf8')

test('infographic theme exposes compatibility hooks to existing encrypted privacy runtimes', () => {
  assert.match(sidebar, /className="notes-list oanix-infographic-notes-scroll"/)
  assert.match(sidebar, /'note-row timeline-item'/)
  assert.match(sidebar, /data-reorder-note-id=\{note\.id\}/)
  assert.match(sidebar, /className="note-row__open infographic-card glass-card"/)
  assert.match(sidebar, /className="note-row__topline"/)
  assert.match(sidebar, /className="notes-search oanix-infographic-search"/)
  assert.match(sidebar, /notes-search__meta/)
  assert.match(sidebar, /className="notes-create-fab fab-add-note"/)
})

test('workspace v2 privacy button opens the existing NotePrivacyRuntime manager', () => {
  assert.match(sidebar, /oanix:open-note-privacy/)
  assert.match(privacy, /window\.addEventListener\('oanix:open-note-privacy', handleOpenNotePrivacy\)/)
  assert.match(privacy, /setPrivacyManagerNoteId\(detail\.noteId\)/)
})

test('privacy compatibility remains styled inside the infographic namespace', () => {
  assert.match(css, /\.timeline-item\.note-row/)
  assert.match(css, /\.infographic-card\.note-row__open/)
  assert.match(css, /\.oanix-infographic-notes-scroll/)
  assert.match(privacy, /row\.querySelector<HTMLElement>\('\[data-v2-note-actions="true"\]'\)/)
  assert.match(privacy, /oanix-note-row-lock--v2-action/)
  assert.match(css, /\.info-right-actions > \.oanix-note-row-lock/)
})

test('workspace v2 nested note actions are not mistaken for note-open clicks by privacy capture', () => {
  assert.match(sidebar, /data-v2-note-actions="true"/)
  assert.match(privacy, /target\.closest<HTMLElement>\('\[data-v2-note-actions="true"\]'\)/)
  assert.match(privacy, /const openButton = isV2NoteAction[\s\S]*\? null[\s\S]*: target\.closest<HTMLElement>\('\.note-row__open'\)/)
})

test('workspace v2 keyboard note opening crosses the same privacy click gate as pointer input', () => {
  assert.match(sidebar, /event\.currentTarget\.click\(\)/)
  assert.match(privacy, /document\.addEventListener\('click', captureWorkspaceClick, true\)/)
})


test('infographic create-note control keeps the real OANIX create callback behind the prototype plus', () => {
  assert.match(sidebar, /className="notes-create-fab fab-add-note"/)
  assert.match(sidebar, /onClick=\{onCreateNote\}/)
  assert.match(sidebar, /<OanixIcon name="plus" size=\{24\}/)
  assert.match(css, /\.fab-add-note[\s\S]*width: 50px !important[\s\S]*height: 50px !important/)
})
