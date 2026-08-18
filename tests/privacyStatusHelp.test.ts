import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainSource = readFileSync('src/main.tsx', 'utf8')
const helpSource = readFileSync('src/features/privacy/PrivacyStatusHelp.tsx', 'utf8')
const polishCss = readFileSync('src/styles/privacy-status-polish.css', 'utf8')

test('privacy manager removes redundant status rows and keeps help beside real actions', () => {
  assert.match(mainSource, /<PrivacyStatusHelp \/>/)
  assert.match(mainSource, /privacy-status-polish\.css/)
  assert.match(polishCss, /\.oanix-privacy-status \{\s*display: none !important;/s)
  assert.match(helpSource, /Proteger nota\|Desbloquear temporalmente\|Quitar protección/)
  assert.match(helpSource, /Caja privada/)
  assert.match(helpSource, /oanix-privacy-action-help/)
  assert.match(polishCss, /\.oanix-privacy-action-help/)
  assert.doesNotMatch(helpSource, /Estado de privacidad/)
})

test('privacy action help remains informative only', () => {
  assert.match(helpSource, /¿Qué hace Proteger nota\?/)
  assert.match(helpSource, /¿Qué hace Caja privada\?/)
  assert.match(helpSource, /1 a 20 caracteres/)
  assert.match(helpSource, /listas y búsquedas normales/)
  assert.match(helpSource, /combinar Caja privada con un código individual/)
  assert.doesNotMatch(helpSource, /setNotePrivacyLock|setNotePrivateBox|writeEncryptedRecord/)
})
