import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CODE_BLOCK_KIND,
  MAX_CODE_BLOCK_LANGUAGE_LENGTH,
  MAX_CODE_BLOCK_TEXT_LENGTH,
  decodeCodeBlock,
  encodeCodeBlock,
} from '../src/features/editor/codeBlockCodec.ts'
import type { EditorSurfaceBlock } from '../src/features/editor/editorSurfaceContract.ts'

test('code codec preserves text and optional language hint', () => {
  const encoded = encodeCodeBlock({
    id: 'code-1',
    kind: CODE_BLOCK_KIND,
    text: 'const answer = 42',
    language: 'typescript',
  })

  assert.deepEqual(encoded, {
    id: 'code-1',
    kind: 'code',
    data: {
      text: 'const answer = 42',
      language: 'typescript',
    },
  })
  assert.deepEqual(decodeCodeBlock(encoded), {
    id: 'code-1',
    kind: 'code',
    text: 'const answer = 42',
    language: 'typescript',
  })
})

test('decoder ignores other rich block kinds', () => {
  const block: EditorSurfaceBlock = {
    id: 'list-1',
    kind: 'checklist',
    data: { items: [] },
  }
  assert.equal(decodeCodeBlock(block), null)
})

test('decoder rejects malformed code payloads', () => {
  assert.equal(decodeCodeBlock({
    id: 'bad',
    kind: 'code',
    data: { text: 123, language: 'js' },
  }), null)

  assert.equal(decodeCodeBlock({
    id: 'bad-2',
    kind: 'code',
    data: { text: 'ok' },
  }), null)
})

test('decoder rejects unexpectedly large code payloads before rendering', () => {
  assert.equal(decodeCodeBlock({
    id: 'too-long',
    kind: 'code',
    data: {
      text: 'x'.repeat(MAX_CODE_BLOCK_TEXT_LENGTH + 1),
      language: '',
    },
  }), null)

  assert.equal(decodeCodeBlock({
    id: 'language-too-long',
    kind: 'code',
    data: {
      text: '',
      language: 'x'.repeat(MAX_CODE_BLOCK_LANGUAGE_LENGTH + 1),
    },
  }), null)
})
