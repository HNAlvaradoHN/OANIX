import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainSource = readFileSync('src/main.tsx', 'utf8')
const helpSource = readFileSync('src/features/privacy/PrivacyStatusHelp.tsx', 'utf8')
const polishCss = readFileSync('src/styles/privacy-status-polish.css', 'utf8')

test('privacy manager presents current state separately from actions', () => {
  assert.match(mainSource, /<PrivacyStatusHelp \/>/)
  assert.match(mainSource, /privacy-status-polish\.css/)
  assert.match(helpSource, /Estado de privacidad/)
  assert.match(helpSource, /Estos dos renglones solo muestran el estado actual/)
  assert.match(polishCss, /\.oanix-privacy-status__heading/)
  assert.match(polishCss, /div:not\(\.oanix-privacy-status__heading\)/)
})

test('privacy status help explains both protections without changing them', () => {
  assert.match(helpSource, /¿Qué significa cada estado\?/)
  assert.match(helpSource, /Protección individual/)
  assert.match(helpSource, /Caja privada/)
  assert.match(helpSource, /barrera extra dentro de la bóveda cifrada de OANIX/)
  assert.match(helpSource, /deja de aparecer en las listas y búsquedas normales/)
  assert.doesNotMatch(helpSource, /setNotePrivacyLock|setNotePrivateBox|writeEncryptedRecord/)
})
