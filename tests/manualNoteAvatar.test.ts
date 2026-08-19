import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const service = readFileSync('src/features/notes/noteAvatarService.ts', 'utf8')
const noteService = readFileSync('src/features/notes/noteService.ts', 'utf8')

test('avatar picker opens a gallery/file selector without opening the note row', () => {
  assert.match(avatar, /input\.type = 'file'/)
  assert.match(avatar, /image\/jpeg,image\/png,image\/webp,image\/gif/)
  assert.match(avatar, /event\.preventDefault\(\)/)
  assert.match(avatar, /event\.stopPropagation\(\)/)
  assert.match(avatar, /data-oanix-avatar-picker="true"/)
})

test('avatar is stored as encrypted metadata plus encrypted image, not as a note block', () => {
  assert.match(service, /NOTE_AVATAR_RECORD_TYPE = 'note-avatar'/)
  assert.match(service, /writeEncryptedRecord\(NOTE_AVATAR_RECORD_TYPE, noteId, next\)/)
  assert.match(service, /storeEncryptedImage\(file\)/)
  assert.doesNotMatch(service, /content\.blocks|ImageBlock|replaceNoteContent/)
  assert.doesNotMatch(avatar, /content\.blocks|firstImageBlock/)
})

test('avatar preview stays encrypted at rest and temporary object URLs are revoked', () => {
  assert.match(service, /loadEncryptedImagePreview/)
  assert.match(avatar, /URL\.createObjectURL/)
  assert.match(avatar, /URL\.revokeObjectURL/)
  assert.doesNotMatch(service, /localStorage|sessionStorage|caches\.open/)
})

test('replacing or deleting a note cleans avatar image data', () => {
  assert.match(service, /deleteEncryptedImage\(previous\.imageId\)/)
  assert.match(service, /deleteEncryptedRecord\(NOTE_AVATAR_RECORD_TYPE, noteId\)/)
  assert.match(noteService, /deleteNoteAvatar\(noteId\)/)
})

test('avatar changes refresh both local avatar instances and after sync', () => {
  assert.match(service, /oanix:note-avatar-changed/)
  assert.match(avatar, /oanix:note-avatar-changed/)
  assert.match(avatar, /oanix:sync-status/)
  assert.match(avatar, /detail\?\.kind === 'synced'/)
})
