import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync(
  'src/features/editor/implementations/ReplicaV16SheetSurface.tsx',
  'utf8',
)
const css = readFileSync(
  'src/features/editor/implementations/replicaV16SheetSurface.css',
  'utf8',
)

test('replica title and body both guard autosave while IME composition is active', () => {
  const starts = surface.match(/onCompositionStart=\{handleCompositionStart\}/g) ?? []
  const ends = surface.match(/onCompositionEnd=\{handleCompositionEnd\}/g) ?? []

  assert.equal(starts.length >= 2, true)
  assert.equal(ends.length >= 2, true)
  assert.match(surface, /if \(!dirtyRef\.current \|\| closingRef\.current \|\| composingRef\.current\) return/)
  assert.match(surface, /if \(!dirtyRef\.current \|\| closingRef\.current \|\| composingRef\.current \|\| idleTimerRef\.current !== null\) return/)
})

test('long replica textareas grow with content instead of creating a nested scroll surface', () => {
  const titleRule = css.match(/\.oanix-replica-v16__title \{[\s\S]*?\n\}/)?.[0] ?? ''
  const bodyRule = css.match(/\.oanix-replica-v16__body \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(titleRule, /field-sizing: content/)
  assert.match(titleRule, /overflow: hidden/)
  assert.match(bodyRule, /field-sizing: content/)
  assert.match(bodyRule, /overflow: hidden/)
  assert.doesNotMatch(bodyRule, /overflow: auto/)
  assert.match(css, /\.oanix-replica-v16 \{[\s\S]*?overflow: auto/)
})
