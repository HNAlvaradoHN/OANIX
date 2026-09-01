import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/QwenSheetSurface.tsx', 'utf8')
const checklist = readFileSync('src/features/editor/implementations/QwenChecklistBlocks.tsx', 'utf8')
const code = readFileSync('src/features/editor/implementations/QwenCodeBlocks.tsx', 'utf8')

test('Qwen exposes one central Insertar action for supported rich blocks', () => {
  assert.match(surface, />\+ Insertar</)
  assert.match(surface, /insertBlock\('checklist'\)/)
  assert.match(surface, /insertBlock\('code'\)/)
  assert.match(surface, /role="menu"/)
  assert.match(surface, /aria-label="Insertar bloque"/)
  assert.doesNotMatch(checklist, />\+ Checklist</)
  assert.doesNotMatch(code, />\+ Código</)
})

test('insert requests stay in memory and reuse the existing block session', () => {
  assert.match(surface, /setChecklistInsertRequest\(\(value\) => value \+ 1\)/)
  assert.match(surface, /setCodeInsertRequest\(\(value\) => value \+ 1\)/)
  assert.match(surface, /insertRequest=\{checklistInsertRequest\}/)
  assert.match(surface, /insertRequest=\{codeInsertRequest\}/)
  assert.equal((surface.match(/createEditorBlockSession\(/g) ?? []).length, 1)
  assert.doesNotMatch(surface, /localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest/)
})

test('block components consume each insert request once after their shared load', () => {
  for (const source of [checklist, code]) {
    assert.match(source, /handledInsertRequestRef = useRef\(insertRequest\)/)
    assert.match(source, /if \(loading \|\| disabled \|\| insertRequest === handledInsertRequestRef\.current\) return/)
    assert.match(source, /handledInsertRequestRef\.current = insertRequest/)
    assert.doesNotMatch(source, /setTimeout|setInterval/)
  }
})
