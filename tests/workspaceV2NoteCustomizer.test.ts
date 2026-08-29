import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const customizer = readFileSync('src/features/notes/WorkspaceV2NoteCustomizer.tsx', 'utf8')
const sidebar = readFileSync('src/features/notes/themes/infographic/InfographicWorkspace.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const noteTypes = readFileSync('src/features/notes/noteTypes.ts', 'utf8')
const css = readFileSync('src/features/notes/themes/infographic/infographicTheme.css', 'utf8')

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


test('note color personalization feeds the isolated infographic glass card', () => {
  const palette = noteTypes.match(/NOTE_VISUAL_COLORS = \[([\s\S]*?)\] as const/)?.[1] ?? ''
  assert.ok((palette.match(/#[0-9a-f]{6}/gi) ?? []).length >= 16)
  assert.match(customizer, /<legend>COLOR DE TARJETA<\/legend>/)
  assert.match(customizer, /onClick=\{\(\) => setColor\(candidate\)\}/)
  assert.match(css, /\.infographic-card\.note-row__open[\s\S]*rgba\(var\(--card-r/)
  assert.match(css, /backdrop-filter: blur\(20px\)/)
})
