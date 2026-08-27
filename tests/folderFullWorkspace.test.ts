import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const folderRuntime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const organicRuntime = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const organicCss = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')
const appearanceService = readFileSync('src/features/folders/folderAppearanceService.ts', 'utf8')
const interactiveCss = readFileSync('src/features/folders/folderInteractive.css', 'utf8')
const notesWorkspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const personalizationRuntime = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')

test('la superficie principal combina cabecera etiquetas notas y dock sin crear otra app', () => {
  assert.match(organicRuntime, /loadFolders/)
  assert.doesNotMatch(organicRuntime, /loadNotes|loadNote\(/)
  assert.match(organicRuntime, /loadTags/)
  assert.match(organicCss, /\.notes-header[\s\S]*backdrop-filter: blur\(15px\)/)
  assert.match(organicCss, /\.oanix-organic-tags/)
  assert.match(organicCss, /\/\* ===== INFOGRAPHIC NOTE CARDS ===== \*\//)
  assert.match(organicCss, /\/\* ===== FOLDER GRID BECOMES THE REAL BOTTOM DOCK ===== \*\//)
})

test('las tarjetas de notas conservan datos y acciones reales con la geometría de la referencia', () => {
  assert.match(notesWorkspace, /visibleNotes\.map/)
  assert.match(notesWorkspace, /notePreview\(note\)/)
  assert.match(notesWorkspace, /toggleNoteMenu/)
  assert.match(organicCss, /\.note-row[\s\S]*min-height: 95px !important/)
  assert.match(organicCss, /margin: -15px 0 0 !important/)
  assert.match(organicCss, /clip-path: polygon\(15% 0%,85% 0%,100% 100%,0% 100%\)/)
  assert.match(personalizationRuntime, /row\.dataset\.oanixNoteCategory = category/)
  assert.doesNotMatch(personalizationRuntime, /row\.style\.setProperty\('--oanix-note-tab-color'/)
  assert.doesNotMatch(organicRuntime, /row\.dataset\.oanixNoteCategory|--oanix-note-tab-color/)
})

test('el dock inferior usa nombres contadores portadas colores y acciones existentes', () => {
  assert.match(folderRuntime, /data\.counts\.get\(folder\.id\) \?\? 0/)
  assert.match(folderRuntime, /folder\.cover/)
  assert.match(folderRuntime, /--oanix-folder-color/)
  assert.match(organicRuntime, /item\.dataset\.oanixOrganicFolderName/)
  assert.match(organicRuntime, /Crear o administrar carpetas/)
  assert.match(organicRuntime, /Opciones de carpeta/)
  assert.match(organicCss, /\.oanix-organic-folder-controls/)
})

test('portada activa ocupa el fondo y Día Noche comparten geometría', () => {
  assert.match(organicRuntime, /activeFolderCover/)
  assert.match(organicRuntime, /activeFolderColor/)
  assert.match(organicCss, /\.oanix-organic-background/)
  assert.match(organicCss, /data-oanix-theme='classic-day'/)
  assert.match(organicCss, /background-size: cover/)
})

test('la paleta e iconos reales siguen juntos y persisten cifrados', () => {
  assert.match(folderRuntime, /🎨 Cambiar color \/ Icono/)
  assert.match(folderRuntime, /saveFolderColor/)
  assert.match(folderRuntime, /saveFolderIcon/)
  assert.match(appearanceService, /writeEncryptedRecord\(FOLDER_APPEARANCE_RECORD, folderId, record\)/)
  assert.match(interactiveCss, /Color \+ icon stay under one button/)
})

test('la experiencia responsive protege viewport safe areas y scroll horizontal', () => {
  assert.match(organicCss, /100dvh/)
  assert.match(organicCss, /env\(safe-area-inset-bottom\)/)
  assert.match(organicCss, /@media \(max-width: 760px\)/)
  assert.match(organicCss, /@media \(max-width: 480px\)/)
  assert.match(organicCss, /\.oanix-folder-rail__scroll[\s\S]*overflow-x: auto !important/)
  assert.match(organicCss, /\.oanix-organic-tags__scroll[\s\S]*overflow-x: auto/)
})

test('el prototipo no introduce dependencias externas ni datos demo', () => {
  assert.doesNotMatch(organicRuntime + organicCss, /cdn\.tailwindcss|unpkg\.com|@phosphor-icons|picsum|unsplash/)
})