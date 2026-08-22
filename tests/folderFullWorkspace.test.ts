import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const appearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')
const appearanceService = readFileSync('src/features/folders/folderAppearanceService.ts', 'utf8')
const fullWorkspaceCss = readFileSync('src/features/folders/folderFullWorkspace.css', 'utf8')
const notesWorkspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const androidBack = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')

test('el inicio de carpetas ocupa el viewport completo y ya no queda encerrado en notes-sidebar', () => {
  assert.match(runtime, /dashboardVisible && createPortal\(/)
  assert.match(runtime, /document\.body,[\s\S]*\)}/)
  assert.doesNotMatch(runtime, /dashboardVisible && targets\.sidebar && createPortal/)
  assert.match(fullWorkspaceCss, /\.oanix-folder-grid[\s\S]*position: fixed !important/)
  assert.match(fullWorkspaceCss, /inset: 0 !important/)
  assert.match(fullWorkspaceCss, /width: 100vw/)
  assert.match(fullWorkspaceCss, /height: 100dvh/)
})

test('escritorio usa una barra compacta solo de iconos y el panel aprovecha el resto de la pantalla', () => {
  assert.match(fullWorkspaceCss, /grid-template-columns: clamp\(4\.5rem, 7vw, 6\.25rem\) minmax\(0, 1fr\)/)
  assert.match(fullWorkspaceCss, /\.oanix-folder-rail__item::after[\s\S]*display: none !important/)
  assert.match(fullWorkspaceCss, /\.oanix-folder-focus__details[\s\S]*max-width: min\(42rem, 74vw\)/)
  assert.match(fullWorkspaceCss, /@media \(max-width: 720px\)/)
  assert.match(fullWorkspaceCss, /@media \(max-width: 390px\)/)
  assert.match(fullWorkspaceCss, /@media \(max-height: 650px\)/)
})

test('Nueva nota sigue siendo una función de la vista interna y nunca forma parte visual del home', () => {
  assert.match(notesWorkspace, /className="notes-create-fab"/)
  assert.match(notesWorkspace, /Nueva nota/)
  assert.match(runtime, /setGridOpen\(false\)/)
  assert.match(runtime, /openFolder/)
  assert.match(fullWorkspaceCss, /\.oanix-folder-grid[\s\S]*z-index: 4200 !important/)
  assert.match(fullWorkspaceCss, /\.notes-create-fab[\s\S]*z-index: 90/)
})

test('la paleta fuerza el color real de cada muestra y conserva persistencia cifrada', () => {
  assert.match(appearance, /folderFullWorkspace\.css/)
  assert.match(appearance, /button\.style\.backgroundColor = color/)
  assert.match(fullWorkspaceCss, /background: var\(--oanix-folder-swatch, #111b31\) !important/)
  assert.match(appearance, /saveFolderColor/)
  assert.match(appearance, /saveFolderIcon/)
  assert.match(appearanceService, /writeEncryptedRecord\(FOLDER_APPEARANCE_RECORD, folderId, record\)/)
  assert.match(appearanceService, /interface FolderAppearanceRecordV1/)
  assert.match(appearanceService, /interface FolderAppearanceRecordV2/)
})

test('el personalizador abre primero un menu profesional y despliega color e icono solo al pedirlo', () => {
  assert.match(appearance, /appearance\.hidden = true/)
  assert.match(appearance, /📂 Abrir carpeta/)
  assert.match(appearance, /🎨 Cambiar color \/ Icono/)
  assert.match(appearance, /🖼️ Cambiar imagen de mi dispositivo/)
  assert.match(appearance, /✏️ Administrar nombre \/ eliminar/)
  assert.match(fullWorkspaceCss, /\.oanix-folder-customizer__actions[\s\S]*grid-template-columns: 1fr/)
  assert.match(fullWorkspaceCss, /\.oanix-folder-customizer__open-action/)
  assert.match(fullWorkspaceCss, /\.oanix-folder-customizer__appearance-toggle/)
})

test('abrir, volver y reordenar conservan los handlers existentes', () => {
  assert.match(runtime, /openSelected/)
  assert.match(runtime, /reorderFolder\(folderId, direction\)/)
  assert.match(runtime, /data-oanix-folder-home-back="true"/)
  assert.match(androidBack, /data-oanix-folder-home-back="true"/)
})
