import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/notes/FolderDockFinishingRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/folderDockFinishing.css', 'utf8')
const appearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')

test('folder dock renders a real persistent name label for every non-add card', () => {
  assert.match(runtime, /\.oanix-folder-rail__item:not\(\.oanix-folder-rail__item--add\)/)
  assert.match(runtime, /label\.className = 'oanix-folder-card__name'/)
  assert.match(runtime, /if \(label\.textContent !== name\) label\.textContent = name/)
  assert.match(css, /\.oanix-folder-card__name[\s\S]*bottom: 34px !important[\s\S]*text-overflow: ellipsis !important/)
  assert.match(css, /\.oanix-folder-rail__item::after[\s\S]*content: none !important/)
})

test('folder options gear is centered below the name and uses a vector mask', () => {
  assert.match(css, /\.oanix-folder-card__gear[\s\S]*left: 50% !important[\s\S]*bottom: 5px !important[\s\S]*transform: translateX\(-50%\) !important/)
  assert.match(css, /\.oanix-folder-card__gear::before[\s\S]*mask-image:/)
  assert.match(css, /\.oanix-folder-card__gear:hover[\s\S]*transform: translate\(-50%,-1px\) !important/)
})

test('folder appearance repaint is idempotent so its MutationObserver cannot self-feed on preview text', () => {
  assert.match(appearance, /if \(shape\.dataset\.oanixFolderIcon !== icon\) shape\.dataset\.oanixFolderIcon = icon/)
  assert.match(appearance, /if \(preview\.textContent !== icon\) preview\.textContent = icon/)
  assert.match(appearance, /if \(element\.style\.getPropertyValue\('--oanix-folder-color'\) !== color\)/)
})

test('folder dock finishing stays mounted before the final v38.3 visual authority', () => {
  const runtimeIndex = main.indexOf('<FolderDockFinishingRuntime />')
  const visualRuntimeIndex = main.indexOf('<V383WorkspaceVisualRuntime />')
  const finalCssIndex = main.indexOf("./features/notes/v383WorkspaceVisual.css")
  assert.ok(runtimeIndex >= 0 && visualRuntimeIndex > runtimeIndex)
  assert.ok(finalCssIndex >= 0)
})
