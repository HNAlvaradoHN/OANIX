import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const reorder = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')

test('avatar sigue pasivo dentro de la superficie de drag de la fila', () => {
  assert.match(reorder, /handle: '\.note-row\[data-reorder-note-id\]'/)
  assert.match(reorder, /\.note-row__menu-wrap/)
  assert.doesNotMatch(avatar, /onPointerDown=/)
  assert.doesNotMatch(avatar, /onClick=/)
  assert.doesNotMatch(avatar, /stopPropagation\(\)|preventDefault\(\)/)
  assert.doesNotMatch(avatar, /createPortal|openImagePicker|selectAvatarFile/)
})
