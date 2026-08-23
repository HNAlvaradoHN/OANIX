import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const appearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')
const appearanceService = readFileSync('src/features/folders/folderAppearanceService.ts', 'utf8')
const gridCss = readFileSync('src/features/folders/folderGrid.css', 'utf8')
const interactiveCss = readFileSync('src/features/folders/folderInteractive.css', 'utf8')
const referenceShell = readFileSync('src/features/folders/folderReferencePolish.css', 'utf8')
const workspaceShell = readFileSync('src/features/folders/folderFullWorkspace.css', 'utf8')
const notesWorkspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const androidBack = readFileSync('src/platform/android/AndroidBackRuntime.tsx', 'utf8')

test('el inicio de carpetas ocupa el viewport completo y reutiliza datos reales', () => {
  assert.match(runtime, /dashboardVisible && createPortal\(/)
  assert.match(runtime, /document\.body,[\s\S]*\)}/)
  assert.match(runtime, /loadFolders\(\)/)
  assert.match(runtime, /loadNotes\(\)/)
  assert.match(runtime, /data\.counts\.get\(folder\.id\) \?\? 0/)
  assert.match(gridCss, /\.oanix-folder-grid[\s\S]*position: fixed/)
  assert.match(gridCss, /inset: 0/)
  assert.match(gridCss, /width: 100vw/)
  assert.match(gridCss, /height: 100dvh/)
})

test('escritorio replica la referencia con rail de 140px, nombres reales y panel glass', () => {
  assert.match(gridCss, /grid-template-columns: 140px minmax\(0, 1fr\)/)
  assert.match(gridCss, /\.oanix-folder-rail__item::after[\s\S]*content: attr\(title\)/)
  assert.match(gridCss, /\.oanix-folder-rail__shape[\s\S]*width: 64px/)
  assert.match(gridCss, /\.oanix-folder-focus__details[\s\S]*max-width: 540px/)
  assert.match(gridCss, /backdrop-filter: blur\(30px\)/)
  assert.match(gridCss, /font-size: clamp\(32px,5vw,44px\)/)
})

test('la misma referencia se convierte en dock inferior en movil sin crear otra app', () => {
  assert.match(gridCss, /@media \(max-width: 768px\)/)
  assert.match(gridCss, /flex-direction: column-reverse/)
  assert.match(gridCss, /height: calc\(95px \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(gridCss, /\.oanix-folder-rail__scroll[\s\S]*flex-direction: row/)
  assert.match(gridCss, /overflow-x: auto/)
  assert.match(gridCss, /\.oanix-folder-rail__item::after \{ display: none; \}/)
})

test('el home muestra abrir carpeta y opciones como las dos acciones visuales sin perder funciones', () => {
  assert.match(runtime, /function openSelected\(\)/)
  assert.match(runtime, /data-oanix-folder-customize="true"/)
  assert.match(gridCss, /The reference has exactly two bottom actions/)
  assert.match(gridCss, /\.oanix-folder-focus__actions > button:nth-child\(n\+3\) \{ display: none; \}/)
  assert.match(gridCss, /content: 'Abrir carpeta'/)
  assert.match(gridCss, /content: 'Opciones'/)
})

test('Nueva nota sigue siendo una función interna y no aparece en el inicio', () => {
  assert.match(notesWorkspace, /className="notes-create-fab"/)
  assert.match(notesWorkspace, /Nueva nota/)
  assert.match(runtime, /setGridOpen\(false\)/)
  assert.match(gridCss, /\.oanix-folder-grid[\s\S]*z-index: 4200/)
  assert.match(gridCss, /\.notes-create-fab \{ z-index: 90; \}/)
})

test('no existe engranaje ficticio en el home y crear carpeta reutiliza el control real', () => {
  assert.doesNotMatch(runtime, /⚙️/)
  assert.match(runtime, /className="oanix-folder-rail__item oanix-folder-rail__item--add"/)
  assert.match(runtime, /onClick=\{openFolderManager\}/)
  assert.match(gridCss, /\.oanix-folder-rail__item--add[\s\S]*order: -30/)
})

test('la paleta e iconos reales siguen juntos bajo un solo boton y persisten cifrados', () => {
  assert.match(appearance, /appearance\.hidden = true/)
  assert.match(appearance, /🎨 Cambiar color \/ Icono/)
  assert.match(appearance, /saveFolderColor/)
  assert.match(appearance, /saveFolderIcon/)
  assert.match(appearanceService, /writeEncryptedRecord\(FOLDER_APPEARANCE_RECORD, folderId, record\)/)
  assert.match(interactiveCss, /Color \+ icon stay under one button/)
  assert.match(interactiveCss, /grid-template-columns: repeat\(5,minmax\(0,1fr\)\)/)
  assert.match(interactiveCss, /grid-template-columns: repeat\(6,minmax\(0,1fr\)\)/)
})

test('el menu de carpeta conserva las acciones existentes con presentacion limpia', () => {
  assert.match(appearance, /📂 Abrir carpeta/)
  assert.match(appearance, /🖼️ Cambiar imagen de mi dispositivo/)
  assert.match(appearance, /✏️ Administrar nombre \/ eliminar/)
  assert.match(interactiveCss, /\.oanix-folder-customizer[\s\S]*width: min\(400px,100%\)/)
  assert.match(interactiveCss, /linear-gradient\(135deg,#1e1b4b 0%,#0f172a 100%\)/)
  assert.match(interactiveCss, /\.oanix-folder-customizer__preview \{ display: none; \}/)
})

test('abrir, buscar, volver y reordenar conservan los handlers actuales', () => {
  assert.match(runtime, /openSelected/)
  assert.match(runtime, /panelSearchResults/)
  assert.match(runtime, /openSearchResult/)
  assert.match(runtime, /reorderFolder\(folderId, direction\)/)
  assert.match(runtime, /data-oanix-folder-home-back="true"/)
  assert.match(androidBack, /data-oanix-folder-home-back="true"/)
  assert.match(interactiveCss, /@keyframes oanix-folder-jiggle/)
})

test('las capas visuales anteriores quedan como shells y no vuelven a competir con la referencia', () => {
  assert.match(referenceShell, /Compatibility shell/)
  assert.match(workspaceShell, /Compatibility shell/)
  assert.doesNotMatch(referenceShell, /\.oanix-folder-stage\s*\{/)
  assert.doesNotMatch(workspaceShell, /\.oanix-folder-grid\s*\{/)
})

test('dia y noche conservan la misma geometria con paletas distintas', () => {
  assert.match(gridCss, /data-oanix-theme='classic-day'/)
  assert.match(gridCss, /background: #eef2f5/)
  assert.match(interactiveCss, /data-oanix-theme='classic-day'/)
  assert.match(interactiveCss, /linear-gradient\(145deg,#ffffff,#eef2f7\)/)
})
