import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('managed text blocks require confirmation before destructive deletion', () => {
  const guard = readFileSync('src/features/editor/oanixAtomicDeleteConfirmation.ts', 'utf8')
  const main = readFileSync('src/main.tsx', 'utf8')
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /oanix-text-atomic__delete-block/)
  assert.match(guard, /window\.confirm/)
  assert.match(guard, /event\.stopImmediatePropagation\(\)/)
  assert.match(guard, /oanixElementKind/)
  assert.match(main, /installOanixAtomicDeleteConfirmation\(\)/)
})
