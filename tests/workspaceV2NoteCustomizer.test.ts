import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const customizer = readFileSync('src/features/notes/WorkspaceV2NoteCustomizer.tsx', 'utf8')
const sidebar = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const noteTypes = readFileSync('src/features/notes/noteTypes.ts', 'utf8')
const css = readFileSync('src/features/notes/workspaceV2.css', 'utf8')

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


test('note color personalization offers a broader palette but renders as layered liquid glass', () => {
  const palette = noteTypes.match(/NOTE_VISUAL_COLORS = \[([\s\S]*?)\] as const/)?.[1] ?? ''
  assert.ok((palette.match(/#[0-9a-f]{6}/gi) ?? []).length >= 16)
  assert.match(css, /oanix-workspace-v2__note-card[\s\S]*radial-gradient\(circle at 18% 4%/)
  assert.match(css, /rgba\(var\(--v2-note-r[\s\S]*\.46\)/)
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*oanix-workspace-v2__note-card[\s\S]*backdrop-filter: none/)
})
