import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const reorder = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')

test('avatar es un handle puro y el runtime nativo toma el gesto desde fuera', () => {
  assert.match(reorder, /target\.closest<HTMLElement>\('\.note-row__avatar'\)/)
  assert.match(reorder, /avatar\.closest<HTMLElement>\('\.note-row\[data-reorder-note-id\]'\)/)
  assert.doesNotMatch(avatar, /onPointerDown=/)
  assert.doesNotMatch(avatar, /onClick=/)
  assert.doesNotMatch(avatar, /stopPropagation\(\)|preventDefault\(\)/)
  assert.doesNotMatch(avatar, /createPortal|openImagePicker|selectAvatarFile/)
})
