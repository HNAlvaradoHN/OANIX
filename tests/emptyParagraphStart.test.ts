import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { decideOanixMixedDocumentLoad } from '../src/features/editor/oanixMixedDocumentLoadPolicy.ts'

test('empty notes start in the ruled line editor while existing plain notes stay plain', () => {
  assert.deepEqual(decideOanixMixedDocumentLoad('', []), {
    mode: 'mixed',
    reason: 'empty-new-note',
  })
  assert.deepEqual(decideOanixMixedDocumentLoad('texto existente', []), {
    mode: 'plain',
    reason: 'no-blocks',
  })
})

test('mixed empty document supplies one stable paragraph row from the start', () => {
  const source = readFileSync('src/features/editor/implementations/OanixMixedDocumentWithFiles.tsx', 'utf8')

  assert.match(source, /const initialParagraphRef = useRef<EditorSurfaceBlock \| null>\(null\)/)
  assert.match(source, /format: 'paragraph'/)
  assert.match(source, /const effectiveBlocks = blocks\.length > 0 \? blocks : \[initialParagraphRef\.current\]/)
  assert.match(source, /const segments = segmentDocument\(effectiveBlocks\)/)
})
