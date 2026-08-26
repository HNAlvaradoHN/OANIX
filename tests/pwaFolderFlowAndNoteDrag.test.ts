import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const folderAppearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')
const polishRuntime = readFileSync('src/app/WorkspaceQuickPolishRuntime.tsx', 'utf8')
const polishCss = readFileSync('src/app/workspaceQuickPolish.css', 'utf8')
const noteDragCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('folder appearance becomes a save-only flow owned by the folder runtime and closes after save', () => {
  assert.match(folderAppearance, /oanix-folder-customizer__appearance-toggle/)
  assert.match(folderAppearance, /appearance\.hidden = false/)
  assert.match(folderAppearance, /actions\.hidden = true/)
  assert.match(folderAppearance, /Promise\.all\(\[/)
  assert.match(folderAppearance, /actions\.hidden = false/)
  assert.match(folderAppearance, /cancelButton\?\.click\(\)/)
  assert.doesNotMatch(polishRuntime, /MutationObserver|oanix-folder-customizer__appearance-toggle/)
})

test('folder gear uses an optically centered pseudo glyph', () => {
  assert.match(polishCss, /\.oanix-folder-card__gear\s*\{[\s\S]*font-size:\s*0\s*!important/)
  assert.match(polishCss, /\.oanix-folder-card__gear::before\s*\{[\s\S]*content:\s*'⚙'/)
  assert.match(polishCss, /align-items:\s*center/)
  assert.match(polishCss, /justify-content:\s*center/)
})

test('sortable fallback note keeps the original card dimensions and stays visible on body', () => {
  assert.match(noteDragCss, /body\s*>\s*\.note-row\.oanix-mobile-note-drag-ghost/)
  assert.match(noteDragCss, /width:\s*var\(--oanix-note-drag-width\)\s*!important/)
  assert.match(noteDragCss, /height:\s*var\(--oanix-note-drag-height\)\s*!important/)
  assert.match(noteDragCss, /visibility:\s*visible\s*!important/)
  assert.match(noteDragCss, /opacity:\s*\.99\s*!important/)
})
