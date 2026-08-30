import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const organicRuntime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const organicCss = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
const coverService = readFileSync('src/features/folders/folderCoverService.ts', 'utf8')
const interactiveCss = readFileSync('src/features/folders/folderInteractive.css', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')

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
  assert.match(runtime, /allCount: visibleNotes\.length/)
})

test('la referencia vigente convierte el rail real en dock inferior dentro del mismo workspace', () => {
  assert.match(organicCss, /\.oanix-folder-grid[\s\S]*inset: auto 0 0 !important/)
  assert.match(organicCss, /height: calc\(135px \+ env\(safe-area-inset-bottom\)\) !important/)
  assert.match(organicCss, /\.oanix-folder-rail[\s\S]*flex-direction: row !important/)
  assert.match(organicCss, /\.oanix-folder-rail__scroll[\s\S]*overflow-x: auto !important/)
  assert.doesNotMatch(runtime, /oanix-folder-focus__menu|oanix-folder-focus__search|className=\{\`oanix-folder-focus/)
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

test('crear y personalizar carpetas usan rutas directas y servicios reales', () => {
  assert.match(organicRuntime, /\.oanix-folder-rail__item--add/)
  assert.match(organicRuntime, /oanix:open-folder-customizer/)
  assert.match(runtime, /saveFolderColor/)
  assert.match(runtime, /saveFolderIcon/)
  assert.match(runtime, /className="oanix-folder-card__gear"/)
  assert.doesNotMatch(organicRuntime + runtime, /\.oanix-folder-focus__menu/)
})

test('mantener presionada una carpeta conserva drag real y la suelta termina el modo automáticamente', () => {
  assert.match(runtime, /FOLDER_LONG_PRESS_MS = 460/)
  assert.match(runtime, /beginFolderPointerDown/)
  assert.match(runtime, /beginDragAt/)
  assert.match(runtime, /queueFolderOrderPersistence\(data\.folders\.map\(\(folder\) => folder\.id\)\)/)
  assert.match(runtime, /persistFolderOrder\(orderToPersist\)/)
  assert.doesNotMatch(runtime, /orderingBusy|setOrderingBusy/)
  assert.match(runtime, /const placeAfter = event\.clientX > rect\.left \+ rect\.width \/ 2/)
  assert.doesNotMatch(runtime, /reorderFolder\(/)
  assert.doesNotMatch(interactiveCss, /@keyframes oanix-folder-jiggle/)
  assert.doesNotMatch(interactiveCss, /animation:\s*oanix-folder-jiggle/)
  assert.match(interactiveCss, /\.oanix-folder-grid--reordering \.oanix-folder-rail__item\[data-oanix-folder-id\][\s\S]*cursor:\s*grab/)
  assert.match(interactiveCss, /\.oanix-folder-grid--reordering \.oanix-folder-rail__item\.is-dragging[\s\S]*opacity:\s*\.28[\s\S]*scale:\s*\.85/)
  assert.doesNotMatch(interactiveCss, /\.oanix-folder-grid--reordering \.oanix-folder-rail__item\.is-dragging[\s\S]*transform:\s*scale\(\.85\)/)
  assert.match(runtime, /function finishFolderDrag[\s\S]*setReorderMode\(false\)/)
  assert.match(runtime, /function cancelFolderGesture[\s\S]*setReorderMode\(false\)/)
  assert.doesNotMatch(runtime + organicRuntime + organicCss, /finishFolderReorder|oanix-folder-rail__done|data-oanix-folder-drop-finishing/)
})

test('el CSS de interacción no conserva controles retirados del personalizador', () => {
  assert.doesNotMatch(interactiveCss, /oanix-folder-customizer__open-action/)
  assert.doesNotMatch(interactiveCss, /oanix-folder-appearance-picker__reset/)
  assert.doesNotMatch(interactiveCss, /oanix-folder-appearance-picker\[hidden\]/)
  assert.doesNotMatch(interactiveCss, /FolderAppearanceRuntime/)
})

test('FolderGridRuntime sigue dentro de la sesión desbloqueada como fuente de comportamiento real', () => {
  assert.match(app, /<NotesWorkspace refreshRevision=\{workspaceRevision\} onLock=\{lockVault\} \/>\s*<WorkspaceRuntimeGate workspaceRevision=\{workspaceRevision\} \/>/)
  assert.doesNotMatch(app, /<NotesWorkspace key=\{workspaceRevision\}/)
  assert.match(legacyGate, /<FolderGridRuntime \/>/)
  assert.match(app, /renderUnlocked=\{\(lockVault\) => <UnlockedApp lockVault=\{lockVault\} \/>\}/)
})
