import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHECKLIST_BLOCK_KIND,
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_ITEM_TEXT_LENGTH,
  decodeChecklistBlock,
  encodeChecklistBlock,
} from '../src/features/editor/checklistBlockCodec.ts'
import type { EditorSurfaceBlock } from '../src/features/editor/editorSurfaceContract.ts'

test('checklist codec preserves the established text plus checked item shape', () => {
  const encoded = encodeChecklistBlock({
    id: 'list-1',
    kind: CHECKLIST_BLOCK_KIND,
    items: [
      { text: 'Comprar pan', checked: false },
      { text: 'Enviar informe', checked: true },
    ],
  })

  assert.deepEqual(encoded, {
    id: 'list-1',
    kind: 'checklist',
    data: {
      items: [
        { text: 'Comprar pan', checked: false },
        { text: 'Enviar informe', checked: true },
      ],
    },
  })
  assert.deepEqual(decodeChecklistBlock(encoded), {
    id: 'list-1',
    kind: 'checklist',
    items: [
      { text: 'Comprar pan', checked: false },
      { text: 'Enviar informe', checked: true },
    ],
  })
})

test('decoder ignores other rich block kinds instead of coercing them', () => {
  const block: EditorSurfaceBlock = {
    id: 'code-1',
    kind: 'code',
    data: { text: 'const x = 1' },
  }
  assert.equal(decodeChecklistBlock(block), null)
})

test('decoder rejects malformed checklist items atomically', () => {
  assert.equal(decodeChecklistBlock({
    id: 'bad',
    kind: 'checklist',
    data: { items: [{ text: 'Missing checked' }] },
  }), null)

  assert.equal(decodeChecklistBlock({
    id: 'bad-2',
    kind: 'checklist',
    data: { items: 'not-an-array' },
  }), null)
})

test('decoder rejects unexpectedly large checklist payloads before rendering', () => {
  assert.equal(decodeChecklistBlock({
    id: 'too-many',
    kind: 'checklist',
    data: {
      items: Array.from({ length: MAX_CHECKLIST_ITEMS + 1 }, () => ({ text: '', checked: false })),
    },
  }), null)

  assert.equal(decodeChecklistBlock({
    id: 'too-long',
    kind: 'checklist',
    data: {
      items: [{ text: 'x'.repeat(MAX_CHECKLIST_ITEM_TEXT_LENGTH + 1), checked: false }],
    },
  }), null)
})
