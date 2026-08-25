import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const service = readFileSync('src/features/notes/noteAvatarService.ts', 'utf8')
const noteService = readFileSync('src/features/notes/noteService.ts', 'utf8')

test('avatar de lista es pasivo y no conserva picker ni menú propio', () => {
  assert.doesNotMatch(avatar, /input\.type = 'file'/)
  assert.doesNotMatch(avatar, /chooseNoteAvatar|deleteNoteAvatar|loadNoteAvatarImage/)
  assert.doesNotMatch(avatar, /createPortal|onClick=|onPointerDown=|stopPropagation/)
  assert.doesNotMatch(avatar, /data-oanix-avatar-picker|data-oanix-avatar-present/)
  assert.match(avatar, /title="Mantén pulsado para reordenar"/)
})

test('avatar almacenado sigue siendo metadata e imagen cifrada, no un bloque de nota', () => {
  assert.match(service, /NOTE_AVATAR_RECORD_TYPE = 'note-avatar'/)
  assert.match(service, /writeEncryptedRecord\(NOTE_AVATAR_RECORD_TYPE, noteId, next\)/)
  assert.match(service, /storeEncryptedImage\(file\)/)
  assert.doesNotMatch(service, /content\.blocks|ImageBlock|replaceNoteContent/)
  assert.doesNotMatch(avatar, /content\.blocks|firstImageBlock/)
})

test('avatar existente puede seguir renderizando preview cifrado sin interfaz de edición', () => {
  assert.match(service, /loadEncryptedImagePreview/)
  assert.match(avatar, /readNoteAvatar\(note\.id\)/)
  assert.match(avatar, /loadNoteAvatarPreview\(note\.id\)/)
  assert.match(avatar, /URL\.createObjectURL/)
  assert.match(avatar, /URL\.revokeObjectURL/)
  assert.doesNotMatch(service, /localStorage|sessionStorage|caches\.open/)
})

test('borrar una nota sigue limpiando sus datos de avatar existentes', () => {
  assert.match(service, /deleteEncryptedImage\(previous\.imageId\)/)
  assert.match(service, /deleteEncryptedRecord\(NOTE_AVATAR_RECORD_TYPE, noteId\)/)
  assert.match(noteService, /deleteNoteAvatar\(noteId\)/)
})

test('avatar existente se refresca tras cambios de datos o sync', () => {
  assert.match(service, /oanix:note-avatar-changed/)
  assert.match(avatar, /oanix:note-avatar-changed/)
  assert.match(avatar, /oanix:sync-status/)
  assert.match(avatar, /detail\?\.kind === 'synced'/)
})
