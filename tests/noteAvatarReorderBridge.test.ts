import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const reorder = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')

test('avatar es un handle puro y no consume eventos antes de SortableJS', () => {
  assert.match(reorder, /handle: '\.note-row__avatar'/)
  assert.doesNotMatch(avatar, /onPointerDown=/)
  assert.doesNotMatch(avatar, /onClick=/)
  assert.doesNotMatch(avatar, /stopPropagation\(\)|preventDefault\(\)/)
  assert.doesNotMatch(avatar, /createPortal|openImagePicker|selectAvatarFile/)
})
