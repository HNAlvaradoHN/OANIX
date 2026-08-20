import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const css = readFileSync('src/features/folders/folderGrid.css', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('el inicio por carpetas reutiliza las carpetas y notas cifradas existentes', () => {
  assert.match(runtime, /loadFolders\(\)/)
  assert.match(runtime, /loadNotes\(\)/)
  assert.match(runtime, /listNotePrivacy\(\)/)
  assert.doesNotMatch(runtime, /createFolder\(|moveNoteToFolder\(|writeEncryptedRecord|writeEncryptedBlob/)
})

test('la cuadrícula no cuenta notas de Caja privada en la interfaz normal', () => {
  assert.match(runtime, /record\.privateBox === true/)
  assert.match(runtime, /privateNoteIds/)
  assert.match(runtime, /notes\.filter\(\(note\) => !privateNoteIds\.has\(note\.id\)\)/)
})

test('las tarjetas abren los filtros ya existentes y el más reutiliza el administrador actual', () => {
  assert.match(runtime, /\.notes-tab:not\(\.notes-tab--add\)/)
  assert.match(runtime, /candidate\.textContent\?\.trim\(\) === folder\.name/)
  assert.match(runtime, /querySelector<HTMLButtonElement>\('\.notes-tab--add'\)/)
  assert.match(runtime, /button\?\.click\(\)/)
})

test('el inicio oculta la lista a primera vista y deja una vuelta clara a carpetas', () => {
  assert.match(runtime, /useState\(true\)/)
  assert.match(runtime, /Todas las notas/)
  assert.match(runtime, /Nueva carpeta/)
  assert.match(runtime, /Volver a carpetas/)
  assert.match(runtime, /oanixFolderCompact/)
  assert.match(css, /notes-tabs-shell\[data-oanix-folder-compact='true'\]/)
})

test('la cuadrícula busca cuatro o cinco tarjetas por fila según el ancho disponible', () => {
  assert.match(css, /grid-template-columns: repeat\(auto-fill, minmax\(3\.45rem, 1fr\)\)/)
  assert.match(css, /oanix-folder-card/)
  assert.match(css, /prefers-reduced-motion: reduce/)
})

test('el runtime vive dentro de la sesión desbloqueada y no sustituye NotesWorkspace', () => {
  assert.match(app, /<NotesWorkspace key=\{workspaceRevision\} onLock=\{lockVault\} \/>/)
  assert.match(app, /<FolderGridRuntime \/>/)
  assert.match(app, /renderUnlocked=\{\(lockVault\) => <UnlockedApp lockVault=\{lockVault\} \/>\}/)
})
