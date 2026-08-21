import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const coverService = readFileSync('src/features/folders/folderCoverService.ts', 'utf8')
const css = readFileSync('src/features/folders/folderGrid.css', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const androidBack = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')

test('el inicio por carpetas reutiliza las carpetas y notas cifradas existentes', () => {
  assert.match(runtime, /loadFolders\(\)/)
  assert.match(runtime, /loadNotes\(\)/)
  assert.match(runtime, /listNotePrivacy\(\)/)
  assert.doesNotMatch(runtime, /createFolder\(|moveNoteToFolder\(|writeEncryptedBlob/)
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

test('la cuadrícula usa cuatro tarjetas por fila y movimiento suave reducible', () => {
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /@keyframes oanix-folder-card-in/)
  assert.match(css, /prefers-reduced-motion: reduce/)
})

test('mantener presionada una carpeta abre personalización sin cambiar FolderRecord', () => {
  assert.match(runtime, /FOLDER_LONG_PRESS_MS = 520/)
  assert.match(runtime, /beginFolderLongPress/)
  assert.match(runtime, /Mantén presionada una carpeta para ponerle una imagen/)
  assert.match(runtime, /Elegir imagen/)
  assert.match(runtime, /Quitar imagen/)
  assert.match(coverService, /FOLDER_COVER_RECORD = 'folder-cover'/)
  assert.match(coverService, /writeEncryptedRecord\(FOLDER_COVER_RECORD, folderId, record\)/)
  assert.match(coverService, /COVER_SIZE = 256/)
  assert.match(coverService, /MAX_SOURCE_BYTES = 8 \* 1024 \* 1024/)
})

test('Atrás en Android vuelve a Carpetas antes de ofrecer salir', () => {
  assert.match(runtime, /data-oanix-folder-home-back="true"/)
  assert.match(androidBack, /data-oanix-folder-home-back="true"/)
  const folderBackIndex = androidBack.indexOf('data-oanix-folder-home-back="true"')
  const exitPromptIndex = androidBack.indexOf('setExitPromptVisible(true)')
  assert.ok(folderBackIndex >= 0 && exitPromptIndex > folderBackIndex)
})

test('el runtime vive dentro de la sesión desbloqueada y no sustituye NotesWorkspace', () => {
  assert.match(app, /<NotesWorkspace key=\{workspaceRevision\} onLock=\{lockVault\} \/>/)
  assert.match(app, /<FolderGridRuntime \/>/)
  assert.match(app, /renderUnlocked=\{\(lockVault\) => <UnlockedApp lockVault=\{lockVault\} \/>\}/)
})
