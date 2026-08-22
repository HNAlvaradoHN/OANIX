import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const appearanceRuntime = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')
const coverService = readFileSync('src/features/folders/folderCoverService.ts', 'utf8')
const css = readFileSync('src/features/folders/folderGrid.css', 'utf8')
const interactiveCss = readFileSync('src/features/folders/folderInteractive.css', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const androidBack = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')

test('el inicio por carpetas reutiliza las carpetas y notas cifradas existentes', () => {
  assert.match(runtime, /loadFolders\(\)/)
  assert.match(runtime, /loadNotes\(\)/)
  assert.match(runtime, /listNotePrivacy\(\)/)
  assert.match(runtime, /loadFolderColors\(\)/)
  assert.doesNotMatch(runtime, /createFolder\(|moveNoteToFolder\(|writeEncryptedBlob/)
})

test('el inicio no expone notas de Caja privada en contadores ni búsqueda del panel', () => {
  assert.match(runtime, /record\.privateBox === true/)
  assert.match(runtime, /privateNoteIds/)
  assert.match(runtime, /const visibleNotes = notes\.filter\(\(note\) => !privateNoteIds\.has\(note\.id\)\)/)
  assert.match(runtime, /notes: visibleNotes/)
})

test('el nuevo inicio usa selector lateral y un panel visual seleccionado', () => {
  assert.match(runtime, /oanix-folder-stage/)
  assert.match(runtime, /oanix-folder-rail/)
  assert.match(runtime, /oanix-folder-focus/)
  assert.match(runtime, /selectedFolderId/)
  assert.match(runtime, /FOLDER_SHAPES/)
  assert.match(css, /grid-template-columns: clamp\(4rem, 19vw, 5rem\) minmax\(0, 1fr\)/)
  assert.doesNotMatch(css, /scroll-snap-type/)
  assert.doesNotMatch(css, /grid-template-columns: repeat\(2/)
})

test('la portada y el color personalizado dominan el panel sin depender de imágenes externas', () => {
  assert.match(runtime, /selectedCover/)
  assert.match(runtime, /data-oanix-folder-id=\{selectedFolder\?\.id\}/)
  assert.match(runtime, /--oanix-folder-color/)
  assert.match(css, /background: var\(--oanix-folder-color\)/)
  assert.match(css, /\.oanix-folder-focus__cover/)
  assert.match(css, /background-size: cover/)
  assert.doesNotMatch(runtime, /https?:\/\//)
})

test('la búsqueda del panel está limitada a la carpeta elegida y permite abrir la nota encontrada', () => {
  assert.match(runtime, /panelSearchResults/)
  assert.match(runtime, /selectedFolderId === 'all' \|\| note\.folderId === selectedFolderId/)
  assert.match(runtime, /noteBlocksToPlainText\(note\.content\.blocks\)/)
  assert.match(runtime, /data-reorder-note-id/)
  assert.match(runtime, /openSearchResult/)
  assert.match(runtime, /Buscar notas dentro de/)
})

test('las acciones del panel reutilizan apertura, portada, color y administrador existentes', () => {
  assert.match(runtime, /openSelected/)
  assert.match(runtime, /data-oanix-folder-customize="true"/)
  assert.match(runtime, />Imagen</)
  assert.match(runtime, />Color</)
  assert.match(runtime, />Nombre</)
  assert.match(runtime, /Administrar nombre \/ eliminar/)
  assert.match(appearanceRuntime, /\.oanix-folder-focus__menu/)
  assert.match(appearanceRuntime, /\[data-oanix-folder-customize\]/)
  assert.match(coverService, /FOLDER_COVER_RECORD = 'folder-cover'/)
  assert.match(coverService, /writeEncryptedRecord\(FOLDER_COVER_RECORD, folderId, record\)/)
})

test('mantener presionado un icono conserva reordenamiento manual con fantasma visible', () => {
  assert.match(runtime, /FOLDER_LONG_PRESS_MS = 460/)
  assert.match(runtime, /beginFolderPointerDown/)
  assert.match(runtime, /setReorderMode\(true\)/)
  assert.match(runtime, /reorderFolder\(folderId, direction\)/)
  assert.match(runtime, /oanix-folder-rail__item\[data-oanix-folder-id\]/)
  assert.match(interactiveCss, /\.oanix-folder-drag-ghost/)
  assert.match(interactiveCss, /\.oanix-folder-drag-ghost__visual/)
})

test('el inicio oculta la lista a primera vista y conserva vuelta funcional a carpetas', () => {
  assert.match(runtime, /useState\(true\)/)
  assert.match(runtime, /Volver a carpetas/)
  assert.match(runtime, /oanixFolderCompact/)
  assert.match(css, /notes-tabs-shell\[data-oanix-folder-compact='true'\]/)
  assert.match(css, /> :not\(\.oanix-folder-breadcrumb\)/)
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
