import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const organicRuntime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const organicCss = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
const appearanceRuntime = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')
const coverService = readFileSync('src/features/folders/folderCoverService.ts', 'utf8')
const interactiveCss = readFileSync('src/features/folders/folderInteractive.css', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')

test('el dock reutiliza carpetas y notas cifradas existentes con contadores reales', () => {
  assert.match(runtime, /loadFolders\(\)/)
  assert.match(runtime, /loadNotes\(\)/)
  assert.match(runtime, /listNotePrivacy\(\)/)
  assert.match(runtime, /loadFolderColors\(\)/)
  assert.match(runtime, /data\.counts\.get\(folder\.id\) \?\? 0/)
  assert.doesNotMatch(runtime, /writeEncryptedBlob/)
})

test('los contadores y búsqueda heredada no exponen notas de Caja privada', () => {
  assert.match(runtime, /record\.privateBox === true/)
  assert.match(runtime, /privateNoteIds/)
  assert.match(runtime, /const visibleNotes = notes\.filter\(\(note\) => !privateNoteIds\.has\(note\.id\)\)/)
  assert.match(runtime, /notes: visibleNotes/)
})

test('la referencia vigente convierte el rail real en dock inferior dentro del mismo workspace', () => {
  assert.match(organicCss, /\.oanix-folder-grid[\s\S]*inset: auto 0 0 !important/)
  assert.match(organicCss, /height: calc\(135px \+ env\(safe-area-inset-bottom\)\) !important/)
  assert.match(organicCss, /\.oanix-folder-rail[\s\S]*flex-direction: row !important/)
  assert.match(organicCss, /\.oanix-folder-rail__scroll[\s\S]*overflow-x: auto !important/)
  assert.match(organicCss, /\.oanix-folder-focus \{ display: none !important; \}/)
  assert.match(runtime, /oanix:select-workspace-folder/)
  assert.match(organicRuntime, /oanix:workspace-folder-committed/)
  assert.doesNotMatch(organicRuntime, /selectWorkspaceFolderFromDock/)
})

test('portada y color reales alimentan el fondo del workspace sin imágenes externas', () => {
  assert.match(organicRuntime, /loadFolderCovers\(\)/)
  assert.match(organicRuntime, /loadFolderColors\(\)/)
  assert.match(organicRuntime, /activeFolderCover/)
  assert.match(organicRuntime, /--oanix-organic-folder-color/)
  assert.match(organicCss, /\.oanix-organic-background--covered/)
  assert.match(organicCss, /background-size: cover/)
  assert.doesNotMatch(organicRuntime, /https?:\/\//)
  assert.match(coverService, /FOLDER_COVER_RECORD = 'folder-cover'/)
})

test('crear y personalizar carpetas siguen usando los handlers reales', () => {
  assert.match(organicRuntime, /\.oanix-folder-rail__item--add/)
  assert.match(organicRuntime, /\.oanix-folder-focus__menu/)
  assert.match(appearanceRuntime, /saveFolderColor/)
  assert.match(appearanceRuntime, /saveFolderIcon/)
  assert.match(appearanceRuntime, /\.oanix-folder-focus__menu/)
})

test('mantener presionada una carpeta conserva drag real y la suelta termina el modo automáticamente', () => {
  assert.match(runtime, /FOLDER_LONG_PRESS_MS = 460/)
  assert.match(runtime, /beginFolderPointerDown/)
  assert.match(runtime, /beginDragAt/)
  assert.match(runtime, /queueFolderOrderPersistence\(data\.folders\.map\(\(folder\) => folder\.id\)\)/)
  assert.match(runtime, /persistFolderOrder\(orderToPersist\)/)
  assert.doesNotMatch(runtime, /disabled=\{orderingBusy\}/)
  assert.match(runtime, /const placeAfter = event\.clientX > rect\.left \+ rect\.width \/ 2/)
  assert.doesNotMatch(runtime, /reorderFolder\(/)
  assert.match(interactiveCss, /@keyframes oanix-folder-jiggle/)
  assert.match(organicRuntime, /finishFolderReorder/)
  assert.match(organicRuntime, /\.oanix-folder-rail__done/)
  assert.match(organicCss, /\.oanix-folder-rail__done \{ display: none !important; \}/)
})

test('FolderGridRuntime sigue dentro de la sesión desbloqueada como fuente de comportamiento real', () => {
  assert.match(app, /<NotesWorkspace key=\{workspaceRevision\} onLock=\{lockVault\} \/>/)
  assert.match(app, /<FolderGridRuntime \/>/)
  assert.match(app, /renderUnlocked=\{\(lockVault\) => <UnlockedApp lockVault=\{lockVault\} \/>\}/)
})
