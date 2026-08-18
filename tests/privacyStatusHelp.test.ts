import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainSource = readFileSync('src/main.tsx', 'utf8')
const helpSource = readFileSync('src/features/privacy/PrivacyStatusHelp.tsx', 'utf8')
const polishCss = readFileSync('src/styles/privacy-status-polish.css', 'utf8')

test('privacy manager shows only two lightweight status rows with inline help', () => {
  assert.match(mainSource, /<PrivacyStatusHelp \/>/)
  assert.match(mainSource, /privacy-status-polish\.css/)
  assert.match(helpSource, /Ayuda sobre Protección individual/)
  assert.match(helpSource, /Ayuda sobre Caja privada/)
  assert.doesNotMatch(helpSource, /Estado de privacidad/)
  assert.match(polishCss, /grid-template-columns: auto minmax\(0, 1fr\) auto/)
  assert.match(polishCss, /border-bottom:/)
  assert.match(polishCss, /\.oanix-privacy-status__help-button/)
  assert.doesNotMatch(polishCss, /\.oanix-privacy-status__heading/)
})

test('each inline privacy help explains one status without changing it', () => {
  assert.match(helpSource, /Protección individual/)
  assert.match(helpSource, /Caja privada/)
  assert.match(helpSource, /bóveda cifrada de OANIX/)
  assert.match(helpSource, /deja de aparecer en las listas y búsquedas normales/)
  assert.match(helpSource, /Este renglón solo informa el estado actual/)
  assert.doesNotMatch(helpSource, /setNotePrivacyLock|setNotePrivateBox|writeEncryptedRecord/)
})
