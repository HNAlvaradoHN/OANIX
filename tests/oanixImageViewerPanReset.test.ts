import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/editor/implementations/OanixMixedDocumentBody.tsx', 'utf8')

test('fullscreen image recenters whenever zoom returns to 100 percent', () => {
  assert.match(source, /if \(nextScale <= 1\) return \{ x: 0, y: 0 \}/)
  assert.match(source, /onWheel=\{\(event\) => \{[\s\S]*applyView\(scale \* \(event\.deltaY < 0 \? 1\.16 : 0\.86\)\)/)
  assert.match(source, /const nextScale = clampScale\(gesture\.scale[\s\S]*applyView\(nextScale, \{/)
  assert.match(source, /onClick=\{\(\) => applyView\(scale - 0\.5\)\}/)
  assert.match(source, /onClick=\{\(\) => applyView\(scale \+ 0\.5\)\}/)
})

test('fullscreen image pan is bounded by rendered image and viewport dimensions', () => {
  assert.match(source, /const maxX = Math\.max\(0, \(image\.offsetWidth \* nextScale - stage\.clientWidth\) \/ 2\)/)
  assert.match(source, /const maxY = Math\.max\(0, \(image\.offsetHeight \* nextScale - stage\.clientHeight\) \/ 2\)/)
  assert.match(source, /x: Math\.min\(maxX, Math\.max\(-maxX, nextOffset\.x\)\)/)
  assert.match(source, /y: Math\.min\(maxY, Math\.max\(-maxY, nextOffset\.y\)\)/)
})
