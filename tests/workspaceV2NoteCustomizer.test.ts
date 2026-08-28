import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const customizer = readFileSync('src/features/notes/WorkspaceV2NoteCustomizer.tsx', 'utf8')
const sidebar = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

test('workspace v2 note cards expose one inline customizer using existing visual fields', () => {
  for (const required of [
    'NOTE_VISUAL_ICONS',
    'NOTE_VISUAL_COLORS',
    'visualDescription',
    'visualCategoryTagId',
    'visualIcon',
    'visualColor',
  ]) {
    assert.ok(customizer.includes(required) || sidebar.includes(required), `missing ${required}`)
  }
  assert.match(sidebar, /setNoteCustomizerId\(note\.id\)/)
  assert.match(sidebar, /<WorkspaceV2NoteCustomizer/)
})

test('workspace v2 note customization persists through setNoteListAppearance', () => {
  assert.match(customizer, /await onSave\(note\.id, \{/)
  assert.match(workspace, /const updated = await setNoteListAppearance\(noteId, input\)/)
  assert.match(workspace, /onCustomizeNote=\{handleV2CustomizeNote\}/)
  assert.match(workspace, /oanix:note-visual-changed/)
})
