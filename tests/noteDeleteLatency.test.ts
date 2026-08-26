import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const service = readFileSync('src/features/notes/noteService.ts', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

test('note deletion returns after the authoritative record is removed', () => {
  assert.match(service, /await assertAttachmentsAllowNoteDeletion\(noteId\)/)
  assert.match(service, /await deleteNoteRecord\(noteId\)/)
  assert.match(service, /void deleteNoteVersionHistory\(noteId\)\.catch/)
  assert.match(service, /void deleteNoteAvatar\(noteId\)\.catch/)
  assert.doesNotMatch(service, /await deleteNoteVersionHistory\(noteId\)/)
  assert.doesNotMatch(service, /await deleteNoteAvatar\(noteId\)/)
})

test('workspace can remove the note as soon as deleteNote resolves while encrypted image cleanup stays background', () => {
  assert.match(workspace, /await deleteNote\(noteId\)/)
  assert.match(workspace, /setNotes\(\(current\) => current\.filter\(\(note\) => note\.id !== noteId\)\)/)
  assert.match(workspace, /void Promise\.all\(/)
  assert.match(workspace, /deleteEncryptedImage/)
})
