import assert from 'node:assert/strict'
import test from 'node:test'
import { findOanixClipboardImage } from '../src/features/editor/oanixClipboardImage.ts'

const image = new File(['png'], 'paste.png', { type: 'image/png' })
const textFile = new File(['txt'], 'note.txt', { type: 'text/plain' })

test('native clipboard image prefers an image DataTransfer item', () => {
  const result = findOanixClipboardImage({
    items: [
      { kind: 'string', type: 'text/plain', getAsFile: () => null },
      { kind: 'file', type: 'image/png', getAsFile: () => image },
    ],
    files: [textFile],
  })

  assert.equal(result, image)
})

test('native clipboard image falls back to clipboard files', () => {
  const result = findOanixClipboardImage({ files: [textFile, image] })
  assert.equal(result, image)
})

test('native clipboard image ignores non-image files and empty payloads', () => {
  assert.equal(findOanixClipboardImage({ files: [textFile] }), null)
  assert.equal(findOanixClipboardImage(null), null)
})
