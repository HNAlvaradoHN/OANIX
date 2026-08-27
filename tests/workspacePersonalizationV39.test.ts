import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const noteTypes = readFileSync('src/features/notes/noteTypes.ts', 'utf8')
const noteService = readFileSync('src/features/notes/noteService.ts', 'utf8')
const folderAppearance = readFileSync('src/features/folders/folderAppearanceService.ts', 'utf8')
const folderGrid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const runtime = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/workspacePersonalization.css', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('la personalización de lista vive dentro del mismo registro cifrado de la nota', () => {
  assert.match(noteTypes, /visualDescription\?: string/)
  assert.match(noteTypes, /visualCategoryTagId\?: string/)
  assert.match(noteTypes, /visualIcon\?: NoteVisualIcon/)
  assert.match(noteTypes, /visualColor\?: string/)
  assert.match(noteTypes, /MAX_NOTE_VISUAL_DESCRIPTION_LENGTH = 140/)
  assert.match(noteService, /export function setNoteListAppearance/)
  assert.match(noteService, /return enqueueNoteMutation\(noteId/)
  assert.doesNotMatch(noteService, /writeEncryptedRecord\(['"]note-appearance/)
})

test('personalizar una nota conserva etiquetas reales y usa iconos y colores validados', () => {
  assert.match(noteService, /existingTagIds = existing\.tagIds \?\? \[\]/)
  assert.match(noteService, /\[categoryTagId, \.\.\.existingTagIds\.filter/)
  assert.match(noteService, /isNoteVisualIcon\(input\.icon\)/)
  assert.match(noteService, /isNoteVisualColor\(color\)/)
  assert.match(runtime, /data\.tags\.map\(\(tag\)/)
  assert.match(runtime, /ICONO CENTRAL/)
  assert.match(runtime, /COLOR DE TARJETA/)
})

test('el menú de tres puntos recibe una sola entrada de personalización', () => {
  assert.match(runtime, /data-oanix-note-customize/)
  assert.match(runtime, /🎨<\/span> Personalizar/)
  assert.match(runtime, /if \(menu && !menu\.querySelector\('\[data-oanix-note-customize\]'\)\)/)
})

test('fijado y favorito de carpeta reutilizan folder-appearance cifrado sin tocar folder-order', () => {
  assert.match(folderAppearance, /pinned\?: boolean/)
  assert.match(folderAppearance, /favorite\?: boolean/)
  assert.match(folderAppearance, /loadFolderAppearanceFlags/)
  assert.match(folderAppearance, /saveFolderPinned/)
  assert.match(folderAppearance, /saveFolderFavorite/)
  assert.match(folderAppearance, /writeEncryptedRecord\(FOLDER_APPEARANCE_RECORD, folderId, record\)/)
  assert.doesNotMatch(folderAppearance, /folder-order/)
})

test('el engranaje abre directamente el único personalizador de carpeta', () => {
  assert.match(folderGrid, /className="oanix-folder-card__gear"/)
  assert.match(folderGrid, /openCustomizer\(folder\)/)
  assert.match(folderGrid, /oanix:open-folder-customizer/)
  assert.doesNotMatch(runtime, /document\.createElement\('span'\)[\s\S]*oanix-folder-card__gear/)
  assert.doesNotMatch(folderGrid, /oanix-folder-focus__menu/)
  assert.equal(existsSync('src/features/folders/FolderCustomizerBridgeRuntime.tsx'), false)
  assert.match(runtime, /applyOanixTheme\(current === 'classic-day' \? 'classic-night' : 'classic-day'\)/)
})

test('las acciones de carpeta viven en el personalizador React real', () => {
  assert.doesNotMatch(folderGrid, /Abrir carpeta/)
  assert.match(folderGrid, /Cambiar color \/ Icono/)
  assert.match(folderGrid, /Guardar/)
  assert.match(folderGrid, /Administrar nombre \/ eliminar/)
  assert.match(folderGrid, /saveFolderColor/)
  assert.match(folderGrid, /saveFolderIcon/)
  assert.doesNotMatch(runtime, /openFolderManagerAction|openFolderCustomizer|toggleFolderFlag/)
  assert.doesNotMatch(runtime, /saveFolderPinned|saveFolderFavorite/)
})

test('la nueva presentación usa el logo real y mantiene fondo legible con Día Noche y responsive', () => {
  assert.match(css, /background-image: var\(--oanix-brand-logo-url\)/)
  assert.match(css, /data-oanix-note-icon/)
  assert.match(css, /--oanix-note-card-color/)
  assert.match(css, /oanix-folder-card__gear/)
  assert.match(css, /oanix-organic-background--covered/)
  assert.match(css, /html\[data-oanix-theme='classic-day'\]/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /@media \(max-width: 480px\)/)
  assert.match(css, /env\(safe-area-inset-bottom\)/)
})

test('los runtimes del workspace se montan con el ciclo de vida desbloqueado sin observar notes-sidebar', () => {
  assert.doesNotMatch(main, /WorkspaceRuntimeGate/)
  assert.match(app, /<WorkspaceRuntimeGate \/>/)
  assert.doesNotMatch(gate, /document\.querySelector/)
  assert.doesNotMatch(gate, /MutationObserver/)
  assert.match(gate, /<WorkspacePersonalizationRuntime \/>/)
  assert.match(gate, /<WorkspacePersonalizationRuntime \/>/)
  assert.doesNotMatch(gate, /FolderCustomizerBridgeRuntime|FolderAppearanceRuntime/)
  assert.doesNotMatch(runtime + css + gate, /cdn\.tailwindcss|unpkg\.com|unsplash|picsum/)
})
