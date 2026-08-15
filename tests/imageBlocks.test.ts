import assert from 'node:assert/strict'
import test from 'node:test'
import {
  IMAGE_ALIGNMENTS,
  IMAGE_MIME_TYPES,
  isNoteRecord,
  normalizeImageAlignment,
  normalizeImageMimeType,
  noteBlocksToPlainText,
  type ImageMimeType,
  type NoteRecord,
} from '../src/features/notes/noteTypes.ts'

function imageNote(mimeType: ImageMimeType, alt?: string): NoteRecord {
  return {
    version: 1,
    id: `note-${mimeType}`,
    title: 'Imagen cifrada',
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    content: {
      format: 'blocks-v1',
      blocks: [
        {
          id: `image-${mimeType}`,
          type: 'image',
          imageId: `blob-${mimeType}`,
          mimeType,
          name: 'foto-prueba.png',
          byteLength: 2048,
          ...(alt === undefined ? {} : { alt }),
        },
      ],
    },
  }
}

test('all supported image MIME types survive note validation', () => {
  assert.deepEqual([...IMAGE_MIME_TYPES], ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

  for (const mimeType of IMAGE_MIME_TYPES) {
    const note = imageNote(mimeType, 'Descripción privada')
    assert.equal(normalizeImageMimeType(mimeType), mimeType)
    assert.equal(isNoteRecord(note), true, `${mimeType} must be valid note metadata`)
  }
})

test('image layout metadata survives note validation', () => {
  assert.deepEqual([...IMAGE_ALIGNMENTS], ['left', 'center', 'right'])

  for (const alignment of IMAGE_ALIGNMENTS) {
    const note = imageNote('image/png')
    const block = note.content.blocks[0]
    if (block.type !== 'image') throw new Error('Expected image block')

    block.widthPercent = 55
    block.alignment = alignment
    block.locked = true
    block.showName = false

    assert.equal(normalizeImageAlignment(alignment), alignment)
    assert.equal(isNoteRecord(note), true, `${alignment} image layout must remain valid`)
  }
})

test('older image blocks without layout metadata remain valid', () => {
  assert.equal(isNoteRecord(imageNote('image/jpeg')), true)
})

test('image previews respect description and filename visibility', () => {
  assert.equal(noteBlocksToPlainText(imageNote('image/png', 'Recibo agosto').content.blocks), 'Recibo agosto')
  assert.equal(noteBlocksToPlainText(imageNote('image/png').content.blocks), 'foto-prueba.png')

  const hiddenName = imageNote('image/png')
  const block = hiddenName.content.blocks[0]
  if (block.type !== 'image') throw new Error('Expected image block')
  block.showName = false
  assert.equal(noteBlocksToPlainText(hiddenName.content.blocks), 'Imagen')
})

test('SVG and malformed image metadata are rejected', () => {
  assert.equal(normalizeImageMimeType('image/svg+xml'), null)
  assert.equal(normalizeImageAlignment('floating'), null)

  const svg = imageNote('image/png') as unknown as {
    content: { blocks: Array<Record<string, unknown>> }
  }
  svg.content.blocks[0].mimeType = 'image/svg+xml'
  assert.equal(isNoteRecord(svg), false)

  const negativeSize = imageNote('image/jpeg') as unknown as {
    content: { blocks: Array<Record<string, unknown>> }
  }
  negativeSize.content.blocks[0].byteLength = -1
  assert.equal(isNoteRecord(negativeSize), false)

  const compactMobile = imageNote('image/png')
  const compactBlock = compactMobile.content.blocks[0]
  if (compactBlock.type !== 'image') throw new Error('Expected image block')
  compactBlock.widthPercent = 22
  assert.equal(isNoteRecord(compactMobile), true, 'mobile image widths must survive persistence validation')

  const tooSmall = imageNote('image/png') as unknown as {
    content: { blocks: Array<Record<string, unknown>> }
  }
  tooSmall.content.blocks[0].widthPercent = 5
  assert.equal(isNoteRecord(tooSmall), false)

  const invalidAlignment = imageNote('image/png') as unknown as {
    content: { blocks: Array<Record<string, unknown>> }
  }
  invalidAlignment.content.blocks[0].alignment = 'floating'
  assert.equal(isNoteRecord(invalidAlignment), false)
})
