import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')
const codeCss = readFileSync('src/features/editor/implementations/oanixCodeBlockCard.css', 'utf8')
const contact = readFileSync('src/features/editor/implementations/OanixContactBlockCard.tsx', 'utf8')

test('all mixed insertions resolve the cursor saved before the side menu steals focus', () => {
  assert.match(surface, /function resolveMixedInsertionTarget\(\): MixedCursorTarget \| null/)
  assert.match(surface, /return pendingMixedImageTargetRef\.current \?\? fallbackMixedCursor\(\)/)
  const uses = surface.match(/const target = resolveMixedInsertionTarget\(\)/g) ?? []
  assert.equal(uses.length, 6)
  assert.match(surface, /function openFilePicker\([\s\S]*const target = resolveMixedInsertionTarget\(\)/)
})

test('code editor contrast wins over the generic note textarea theme rule', () => {
  assert.match(codeCss, /\.oanix-notes \.oanix-code-block__editor/)
  assert.match(codeCss, /color:#e5e7eb;-webkit-text-fill-color:#e5e7eb/)
  assert.match(codeCss, /caret-color:#f8fafc/)
  assert.match(codeCss, /\.oanix-notes\[data-theme="dark"\][\s\S]*data-theme="midnight"/)
})

test('contact cards reopen locked and expose editing only through their lock menu', () => {
  assert.match(contact, /const \[editing, setEditing\] = useState\(false\)/)
  assert.match(contact, /readOnly=\{!editing\}/)
  assert.match(contact, /Editar contacto/)
  assert.match(contact, /Bloquear edición/)
  assert.match(contact, /editing \? '🔓' : '🔒'/)
})
