import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sidebar = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const privacy = readFileSync('src/features/privacy/NotePrivacyRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/workspaceV2.css', 'utf8')

test('workspace v2 exposes compatibility hooks to existing encrypted privacy runtimes', () => {
  assert.match(sidebar, /className="notes-list oanix-workspace-v2__notes-scroll"/)
  assert.match(sidebar, /note-row oanix-workspace-v2__timeline-item/)
  assert.match(sidebar, /data-reorder-note-id=\{note\.id\}/)
  assert.match(sidebar, /note-row__open oanix-workspace-v2__note-card/)
  assert.match(sidebar, /note-row__topline oanix-workspace-v2__note-title-line/)
  assert.match(sidebar, /className="notes-search oanix-workspace-v2__search"/)
  assert.match(sidebar, /notes-search__meta/)
  assert.match(sidebar, /notes-create-fab oanix-workspace-v2__create-note/)
})

test('workspace v2 privacy button opens the existing NotePrivacyRuntime manager', () => {
  assert.match(sidebar, /oanix:open-note-privacy/)
  assert.match(privacy, /window\.addEventListener\('oanix:open-note-privacy', handleOpenNotePrivacy\)/)
  assert.match(privacy, /setPrivacyManagerNoteId\(detail\.noteId\)/)
})

test('legacy compatibility classes are visually reset under the v2 namespace', () => {
  assert.match(css, /\.oanix-workspace-v2 \.oanix-workspace-v2__timeline-item\.note-row/)
  assert.match(css, /\.oanix-workspace-v2 \.oanix-workspace-v2__note-card\.note-row__open/)
  assert.match(css, /\.oanix-workspace-v2 \.oanix-workspace-v2__notes-scroll\.notes-list/)
  assert.match(css, /\.oanix-workspace-v2__timeline-item > \.oanix-note-row-lock/)
})

test('workspace v2 nested note actions are not mistaken for note-open clicks by privacy capture', () => {
  assert.match(sidebar, /data-v2-note-actions="true"/)
  assert.match(privacy, /target\.closest<HTMLElement>\('\[data-v2-note-actions="true"\]'\)/)
  assert.match(privacy, /const openButton = isV2NoteAction[\s\S]*\? null[\s\S]*: target\.closest<HTMLElement>\('\.note-row__open'\)/)
})
