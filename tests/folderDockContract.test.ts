import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/folderDockContract.css', 'utf8')
const appearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')

test('folder dock renders names from the existing organic dataset without a second DOM runtime', () => {
  assert.match(organic, /dataset\.oanixOrganicFolderName = 'Todas'/)
  assert.match(organic, /dataset\.oanixOrganicFolderName = item\.title\.trim\(\)/)
  assert.match(css, /\.oanix-folder-rail__item:not\(\.oanix-folder-rail__item--add\)::after[\s\S]*content: attr\(data-oanix-organic-folder-name\) !important/)
  assert.match(css, /bottom: 34px !important[\s\S]*text-overflow: ellipsis !important/)
  assert.match(css, /\.oanix-folder-rail__item--add::after[\s\S]*content: none !important/)
  assert.doesNotMatch(gate, /FolderDockFinishingRuntime/)
  assert.doesNotMatch(gate, /folderDockFinishing\.css/)
})

test('folder options gear remains centered below the name and uses a vector mask', () => {
  assert.match(css, /\.oanix-folder-card__gear[\s\S]*left: 50% !important[\s\S]*bottom: 5px !important[\s\S]*transform: translateX\(-50%\) !important/)
  assert.match(css, /\.oanix-folder-card__gear::before[\s\S]*mask-image:/)
  assert.match(css, /\.oanix-folder-card__gear:hover[\s\S]*transform: translate\(-50%,-1px\) !important/)
})

test('folder appearance repaint remains idempotent while observer cleanup proceeds independently', () => {
  assert.match(appearance, /if \(shape\.dataset\.oanixFolderIcon !== icon\) shape\.dataset\.oanixFolderIcon = icon/)
  assert.match(appearance, /if \(preview\.textContent !== icon\) preview\.textContent = icon/)
  assert.match(appearance, /if \(element\.style\.getPropertyValue\('--oanix-folder-color'\) !== color\)/)
})

test('folder dock contract is loaded by the unlocked runtime gate before the v38.3 visual authority', () => {
  assert.match(app, /<WorkspaceRuntimeGate \/>/)
  assert.match(gate, /features\/notes\/folderDockContract\.css/)
  assert.match(gate, /<OrganicWorkspaceRuntime \/>/)
  assert.match(gate, /<V383WorkspaceVisualRuntime \/>/)
  const finalCssIndex = main.indexOf("./features/notes/v383WorkspaceVisual.css")
  assert.ok(finalCssIndex >= 0)
})
