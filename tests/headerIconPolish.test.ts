import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const icons = readFileSync('src/styles/header-icon-polish.css', 'utf8')
const notes = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const history = readFileSync('src/features/versionHistory/VersionHistoryCenter.tsx', 'utf8')

test('final header polish loads after the general visual layers', () => {
  const finalIndex = main.indexOf("./styles/final-visual-polish.css")
  const iconIndex = main.indexOf("./styles/header-icon-polish.css")
  assert.ok(finalIndex >= 0)
  assert.ok(iconIndex > finalIndex)
})

test('visible header emoji actions are visually replaced by one vector icon family', () => {
  assert.match(notes, />\s*🔍\s*</)
  assert.match(notes, />\s*🔒\s*</)
  assert.match(history, />\s*🕘\s*</)
  assert.match(app, />\s*👤\s*</)
  assert.match(icons, /aria-label='Buscar en notas'/)
  assert.match(icons, /aria-label='Cerrar búsqueda'/)
  assert.match(icons, /aria-label='Bloquear OANIX'/)
  assert.match(icons, /\.version-history-launcher::before/)
  assert.match(icons, /\.account-header-action::before/)
  assert.match(icons, /mask-image: url/)
  assert.match(icons, /background-color: currentColor/)
})

test('icon replacement preserves accessible labels and now has stronger theme-aware contrast', () => {
  assert.match(notes, /aria-label=\{searchOpen \? 'Cerrar búsqueda' : 'Buscar en notas'\}/)
  assert.match(notes, /aria-label="Bloquear OANIX"/)
  assert.match(history, /aria-label="Historial de versiones"/)
  assert.match(app, /aria-label="Cuenta de OANIX"/)
  assert.match(icons, /color-mix\(in srgb, var\(--theme-text/)
  assert.match(icons, /var\(--theme-accent/)
  assert.match(icons, /drop-shadow/)
  assert.match(icons, /width: 1\.24rem/)
})
