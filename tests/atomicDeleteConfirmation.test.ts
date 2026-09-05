import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('managed text blocks require local confirmation before destructive deletion', () => {
  const main = readFileSync('src/main.tsx', 'utf8')
  const editor = readFileSync('src/features/editor/implementations/OanixTextLineEditor.tsx', 'utf8')

  assert.match(editor, /oanix-text-atomic__delete-block/)
  assert.match(editor, /function removeAtomicBlock\(lineId: string\)[\s\S]*window\.confirm/)
  assert.match(editor, /line\.format === 'quote'[\s\S]*'Cita'[\s\S]*line\.format === 'list'[\s\S]*'Lista'[\s\S]*'Lista numérica'/)
  assert.match(editor, /window\.confirm\([\s\S]*\)\) return[\s\S]*getLineEl\(lineId\)\?\.remove\(\)/)
  assert.doesNotMatch(main, /oanixAtomicDeleteConfirmation|installOanixAtomicDeleteConfirmation/)
})
