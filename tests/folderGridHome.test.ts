import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const coverService = readFileSync('src/features/folders/folderCoverService.ts', 'utf8')
const css = readFileSync('src/features/folders/folderGrid.css', 'utf8')
const interactiveCss = readFileSync('src/features/folders/folderInteractive.css', 'utf8')
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

test('el inicio oculta la lista a primera vista y conserva una vuelta funcional a carpetas', () => {
  assert.match(runtime, /useState\(true\)/)
  assert.match(runtime, /Todas las notas/)
  assert.match(runtime, /Nueva carpeta/)
  assert.match(runtime, /Volver a carpetas/)
  assert.match(runtime, /oanixFolderCompact/)
  assert.match(css, /notes-tabs-shell\[data-oanix-folder-compact='true'\]/)
  assert.match(css, /> :not\(\.oanix-folder-breadcrumb\)/)
})

test('el nuevo inicio usa una sola galería vertical con snap y desvanecido de bordes', () => {
  assert.match(css, /vertical gallery v1/)
  assert.match(css, /\.oanix-folder-grid__cards[\s\S]*display: flex;[\s\S]*flex-direction: column;/)
  assert.match(css, /scroll-snap-type: y mandatory/)
  assert.match(css, /scroll-snap-align: center/)
  assert.match(css, /scroll-snap-stop: always/)
  assert.match(css, /mask-image: linear-gradient\(to bottom, transparent 0, #000 \d+%, #000 \d+%, transparent 100%\)/)
  assert.doesNotMatch(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(interactiveCss, /oanix-folder-premium-jiggle/)
  assert.match(interactiveCss, /\.oanix-folder-drag-ghost/)
})

test('la tarjeta visual conserva tamaño completo, portada, nombre en una línea, contador y menú de esquina', () => {
  assert.match(css, /height: clamp\(9\.2rem, 22dvh, 10\.8rem\)/)
  assert.match(css, /@media \(max-height: 700px\)[\s\S]*height: 8\.8rem;[\s\S]*min-height: 8\.8rem;/)
  assert.match(css, /\.oanix-folder-card__visual[\s\S]*grid-column: 1;/)
  assert.match(css, /text-overflow: ellipsis/)
  assert.match(css, /white-space: nowrap/)
  assert.match(css, /\.oanix-folder-card__menu[\s\S]*right: \.52rem;[\s\S]*bottom: \.48rem;/)
  assert.match(css, /var\(--oanix-folder-color\)/)
})

test('mantener presionada una carpeta activa orden manual y el menú conserva personalización', () => {
  assert.match(runtime, /FOLDER_LONG_PRESS_MS = 460/)
  assert.match(runtime, /beginFolderPointerDown/)
  assert.match(runtime, /setReorderMode\(true\)/)
  assert.match(runtime, /reorderFolder\(folderId, direction\)/)
  assert.match(runtime, /Mantén presionada una carpeta para ordenar/)
  assert.match(runtime, /className="oanix-folder-card__menu"/)
  assert.match(runtime, /Cambiar imagen/)
  assert.match(runtime, /Quitar imagen/)
  assert.match(runtime, /Administrar nombre \/ eliminar/)
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
