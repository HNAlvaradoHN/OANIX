import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileProtectedBlocks } from '../src/features/editor/protectedBlocks.ts'
import type { StoredNoteBlock } from '../src/features/notes/noteTypes.ts'

type Paragraph = Extract<StoredNoteBlock, { type: 'paragraph' }>
type Code = Extract<StoredNoteBlock, { type: 'code' }>
type Image = Extract<StoredNoteBlock, { type: 'image' }>

function paragraph(id: string, text: string): Paragraph {
  return { id, type: 'paragraph', runs: text ? [{ text }] : [] }
}

function code(id: string, text: string): Code {
  return { id, type: 'code', language: 'typescript', text }
}

function image(id: string): Image {
  return {
    id,
    type: 'image',
    imageId: `blob-${id}`,
    mimeType: 'image/jpeg',
    name: `${id}.jpg`,
    byteLength: 1024,
  }
}

test('accidental select-all deletion restores image and code blocks', () => {
  const previous: StoredNoteBlock[] = [
    paragraph('p-before', 'Antes'),
    image('image-1'),
    code('code-1', 'const safe = true'),
    paragraph('p-after', 'Después'),
  ]
  const next: StoredNoteBlock[] = [paragraph('empty-after-delete', '')]

  const result = reconcileProtectedBlocks(previous, next)

  assert.equal(result.repaired, true)
  assert.deepEqual(
    result.blocks.filter((block) => block.type === 'image' || block.type === 'code'),
    [image('image-1'), code('code-1', 'const safe = true')],
  )
})

test('protected blocks are restored close to surviving neighbors', () => {
  const previous: StoredNoteBlock[] = [
    paragraph('a', 'A'),
    image('img'),
    paragraph('b', 'B'),
    code('code', 'x'),
    paragraph('c', 'C'),
  ]
  const next: StoredNoteBlock[] = [paragraph('a', 'A'), paragraph('b', ''), paragraph('c', 'C')]

  const result = reconcileProtectedBlocks(previous, next)
  assert.deepEqual(result.blocks.map((block) => block.id), ['a', 'img', 'b', 'code', 'c'])
})

test('external selection cannot silently alter code contents', () => {
  const previous: StoredNoteBlock[] = [paragraph('a', 'A'), code('code', 'original'), paragraph('b', 'B')]
  const next: StoredNoteBlock[] = [paragraph('a', ''), code('code', 'damaged'), paragraph('b', '')]

  const result = reconcileProtectedBlocks(previous, next)
  const restored = result.blocks.find((block) => block.id === 'code')
  assert.deepEqual(restored, code('code', 'original'))
})

test('direct editing inside a code block remains allowed', () => {
  const previous: StoredNoteBlock[] = [code('code', 'old')]
  const next: StoredNoteBlock[] = [code('code', 'new')]

  const result = reconcileProtectedBlocks(previous, next, {
    mutableCodeIds: new Set(['code']),
  })

  assert.equal(result.repaired, false)
  assert.deepEqual(result.blocks, next)
})

test('explicit protected-block deletion is allowed', () => {
  const previous: StoredNoteBlock[] = [paragraph('a', 'A'), image('img'), code('code', 'x'), paragraph('b', 'B')]
  const next: StoredNoteBlock[] = [paragraph('a', 'A'), paragraph('b', 'B')]

  const result = reconcileProtectedBlocks(previous, next, {
    allowedRemovedIds: new Set(['img', 'code']),
  })

  assert.equal(result.repaired, false)
  assert.deepEqual(result.blocks, next)
})

test('new code blocks are accepted and image metadata changes are not rolled back', () => {
  const oldImage = image('img')
  const nextImage: Image = { ...oldImage, alignment: 'right', widthPercent: 45 }
  const previous: StoredNoteBlock[] = [oldImage]
  const next: StoredNoteBlock[] = [nextImage, code('new-code', 'hello')]

  const result = reconcileProtectedBlocks(previous, next)
  assert.equal(result.repaired, false)
  assert.deepEqual(result.blocks, next)
})
