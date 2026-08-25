import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const catalog = readFileSync('src/features/folders/folderAppearanceCatalog.ts', 'utf8')
const service = readFileSync('src/features/folders/folderAppearanceService.ts', 'utf8')
const runtime = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')
const gridCss = readFileSync('src/features/folders/folderGrid.css', 'utf8')
const interactiveCss = readFileSync('src/features/folders/folderInteractive.css', 'utf8')

test('la apariencia conserva registros de color v1 y añade iconos cifrados sin borrar preferencias existentes', () => {
  assert.match(service, /interface FolderAppearanceRecordV1/)
  assert.match(service, /interface FolderAppearanceRecordV2/)
  assert.match(service, /readEncryptedRecord<FolderAppearanceRecord>/)
  assert.match(service, /saveFolderIcon/)
  assert.match(service, /removeFolderIcon/)
  assert.match(service, /writeEncryptedRecord\(FOLDER_APPEARANCE_RECORD, folderId, record\)/)
  assert.match(service, /existing\?\.version === 1 \? existing\.color/)
})

test('el catálogo ofrece una paleta amplia y solo iconos reales, sin huecos del prototipo', () => {
  const colors = catalog.match(/#[0-9a-f]{6}/gi) ?? []
  assert.ok(new Set(colors.map((value) => value.toLowerCase())).size >= 24)
  assert.match(catalog, /FOLDER_ICON_OPTIONS/)
  assert.match(catalog, /'⭐'/)
  assert.match(catalog, /'📁'/)
  assert.match(catalog, /'🔐'/)
  assert.match(catalog, /'🧪'/)
  assert.doesNotMatch(catalog, /FOLDER_ICON_OPTIONS[\s\S]*''/)
})

test('el selector de apariencia pinta color e icono sin reemplazar la portada cifrada del panel', () => {
  assert.match(runtime, /loadFolderColors\(\)/)
  assert.match(runtime, /loadFolderIcons\(\)/)
  assert.match(runtime, /saveFolderColor/)
  assert.match(runtime, /saveFolderIcon/)
  assert.match(runtime, /shape\.dataset\.oanixFolderIcon = icon/)
  assert.doesNotMatch(runtime, /folderReferencePolish\.css/)
  assert.doesNotMatch(runtime, /folderFullWorkspace\.css/)
})

test('la presentación activa conserva adaptación móvil y el selector de iconos responsive', () => {
  assert.match(gridCss, /@media \(max-width: 768px\)/)
  assert.match(gridCss, /flex-direction: column-reverse/)
  assert.match(gridCss, /data-oanix-folder-icon/)
  assert.match(interactiveCss, /@media \(max-width: 480px\)/)
  assert.match(interactiveCss, /@media \(max-width: 360px\)/)
  assert.match(interactiveCss, /grid-template-columns: repeat\(6,minmax\(0,1fr\)\)/)
})
