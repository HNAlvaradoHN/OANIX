import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const grid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const service = readFileSync('src/features/folders/folderAppearanceService.ts', 'utf8')

test('folder color and icon are rendered and saved directly by the grid runtime', () => {
  assert.match(grid, /FOLDER_COLOR_PRESETS\.map/)
  assert.match(grid, /FOLDER_ICON_OPTIONS\.map/)
  assert.match(grid, /customDraftColor/)
  assert.match(grid, /customDraftIcon/)
  assert.match(grid, /Promise\.all\(\[\s*saveFolderColor\(folderId, color\),\s*saveFolderIcon\(folderId, icon\)/)
  assert.match(grid, /folder\.icon/)
})

test('direct appearance keeps the existing encrypted record service', () => {
  assert.match(service, /FOLDER_APPEARANCE_RECORD = 'folder-appearance'/)
  assert.match(service, /serializeAppearanceWrite/)
  assert.doesNotMatch(grid, /localStorage|sessionStorage|indexedDB|caches\.open/)
})
