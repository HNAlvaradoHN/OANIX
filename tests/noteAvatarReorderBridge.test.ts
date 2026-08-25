import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const avatar = readFileSync('src/features/notes/NoteAvatar.tsx', 'utf8')
const reorder = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')

test('el avatar deja pasar pointerdown al runtime de reorder', () => {
  assert.match(reorder, /handle: '\.note-row__avatar'/)
  assert.doesNotMatch(avatar, /function handlePointerDown/)
  assert.doesNotMatch(avatar, /onPointerDown=\{handlePointerDown\}/)
  assert.match(avatar, /onClick=\{handleClick\}/)
})
