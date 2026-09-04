import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')
const code = readFileSync('src/features/editor/implementations/OanixCodeBlockCard.tsx', 'utf8')
const codeCss = readFileSync('src/features/editor/implementations/oanixCodeBlockCard.css', 'utf8')
const contact = readFileSync('src/features/editor/implementations/OanixContactBlockCard.tsx', 'utf8')
const contactCss = readFileSync('src/features/editor/implementations/oanixContactBlockCard.css', 'utf8')

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

test('code block exposes a fullscreen reading view without changing its stored text', () => {
  assert.match(code, /const \[expanded, setExpanded\] = useState\(false\)/)
  assert.match(code, /Abrir código en pantalla completa/)
  assert.match(code, /aria-label="Código en pantalla completa"/)
  assert.match(code, /<pre className="oanix-code-block__fullscreen-content">\{textRef\.current/)
  assert.match(codeCss, /\.oanix-code-block__fullscreen\{position:fixed;inset:0/)
  assert.match(codeCss, /height:100dvh/)
})

test('contact fields enforce their intended input semantics', () => {
  assert.match(contact, /inputMode="numeric" pattern="\[0-9\]\*"/)
  assert.match(contact, /placeholder="Número de teléfono"/)
  assert.doesNotMatch(contact, /\+504/)
  assert.match(contact, /handlePhoneChange/)
  assert.match(contact, /isValidContactEmail/)
  assert.match(contact, /Correo no válido; no se guardó\./)
})

test('contact fullscreen control belongs only to notes and keeps lock semantics', () => {
  assert.match(contact, /Abrir notas en pantalla completa/)
  assert.match(contact, /aria-label="Notas del contacto en pantalla completa"/)
  assert.doesNotMatch(contact, /Abrir contacto en pantalla completa/)
  assert.match(contact, /aria-label="Notas del contacto"/)
  assert.match(contact, /readOnly=\{!editing\}/)
  assert.match(contactCss, /\.oanix-contact-block__fullscreen\{position:fixed;inset:0/)
  assert.match(contactCss, /\.oanix-contact-block__fullscreen-notes/)
  assert.match(contactCss, /height:100dvh/)
})
