import assert from 'node:assert/strict'
import test from 'node:test'
import {
  IMAGE_MIME_TYPES,
  isNoteRecord,
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

test('image previews expose only description or filename to local plain-text helpers', () => {
  assert.equal(noteBlocksToPlainText(imageNote('image/png', 'Recibo agosto').content.blocks), 'Recibo agosto')
  assert.equal(noteBlocksToPlainText(imageNote('image/png').content.blocks), 'foto-prueba.png')
})

test('SVG and malformed image metadata are rejected', () => {
  assert.equal(normalizeImageMimeType('image/svg+xml'), null)

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
})
