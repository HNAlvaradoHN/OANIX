import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const service = readFileSync('src/features/notes/noteAvatarService.ts', 'utf8')
const noteService = readFileSync('src/features/notes/noteService.ts', 'utf8')
const avatarCss = readFileSync('src/features/notes/noteAvatarActions.css', 'utf8')

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

test('avatar preview and full view stay encrypted at rest and temporary object URLs are revoked', () => {
  assert.match(service, /loadEncryptedImagePreview/)
  assert.match(service, /loadEncryptedImage\(avatar\.imageId, avatar\.mimeType\)/)
  assert.match(avatar, /loadNoteAvatarImage/)
  assert.match(avatar, /URL\.createObjectURL/)
  assert.match(avatar, /URL\.revokeObjectURL/)
  assert.doesNotMatch(service, /localStorage|sessionStorage|caches\.open/)
})

test('existing avatar opens explicit view change delete actions', () => {
  assert.match(avatar, />Ver<\/button>/)
  assert.match(avatar, />Cambiar<\/button>/)
  assert.match(avatar, />Eliminar<\/button>/)
  assert.match(avatar, /if \(!hasAvatar\)[\s\S]*selectAvatarFile\(\)/)
  assert.match(avatar, /const nextPosition = menuPositionFor\(event\.currentTarget\)/)
  assert.match(avatar, /setMenuPosition\(\(current\) => current \? null : nextPosition\)/)
  assert.doesNotMatch(avatar, /setMenuPosition\(\(current\) =>[\s\S]{0,120}event\.currentTarget/)
  assert.match(avatarCss, /\.oanix-avatar-menu/)
  assert.match(avatarCss, /\.oanix-avatar-viewer/)
})

test('deleting avatar asks confirmation and returns to the note initial', () => {
  assert.match(avatar, /window\.confirm\('¿Eliminar la foto del avatar de esta nota\?'\)/)
  assert.match(avatar, /deleteNoteAvatar\(note\.id\)/)
  assert.match(avatar, /setHasAvatar\(false\)/)
  assert.match(avatar, /noteInitial\(note\.title\)/)
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
