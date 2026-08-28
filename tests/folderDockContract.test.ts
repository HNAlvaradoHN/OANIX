import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/folderDockContract.css', 'utf8')
const quickPolishCss = readFileSync('src/app/workspaceQuickPolish.css', 'utf8')
const grid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')

test('folder dock renders names from the existing organic dataset without a second DOM runtime', () => {
  assert.match(organic, /dataset\.oanixOrganicFolderName = 'Todas'/)
  assert.match(organic, /dataset\.oanixOrganicFolderName = item\.title\.trim\(\)/)
  assert.match(css, /\.oanix-folder-rail__item:not\(\.oanix-folder-rail__item--add\)::after[\s\S]*content: attr\(data-oanix-organic-folder-name\) !important/)
  assert.match(css, /bottom: 34px !important[\s\S]*text-overflow: ellipsis !important/)
  assert.match(css, /\.oanix-folder-rail__item--add::after[\s\S]*content: none !important/)
  assert.doesNotMatch(gate, /FolderDockFinishingRuntime/)
  assert.doesNotMatch(gate, /folderDockFinishing\.css/)
})

test('folder options gear remains centered below the name and uses a single vector-mask authority', () => {
  assert.match(css, /\.oanix-folder-card__gear[\s\S]*left: 50% !important[\s\S]*bottom: 5px !important[\s\S]*transform: translateX\(-50%\) !important/)
  assert.match(css, /\.oanix-folder-card__gear::before[\s\S]*mask-image:/)
  assert.match(css, /\.oanix-folder-card__gear:hover[\s\S]*transform: translate\(-50%,-1px\) !important/)
  assert.doesNotMatch(quickPolishCss, /\.oanix-folder-card__gear::before/)
  assert.doesNotMatch(quickPolishCss, /\.oanix-folder-card__gear\s*\{[\s\S]*?font-size:\s*0 !important/)
})

test('folder appearance is rendered directly without observer repaint', () => {
  assert.match(grid, /folder\.icon/)
  assert.match(grid, /style=\{\{ '--oanix-folder-color': folder\.color \}/)
  assert.match(grid, /loadFolderIcons/)
  assert.doesNotMatch(grid, /paintFolders|decorateCustomizer/)
})

test('legacy folder dock and v38.3 CSS stay in the lazy fallback chunk with stable override order', () => {
  assert.match(app, /<WorkspaceRuntimeGate workspaceRevision=\{workspaceRevision\} \/>/)
  assert.match(visualRuntime, /\.\/v383WorkspaceVisual\.css/)
  assert.doesNotMatch(legacyGate, /folderDockContract\.css/)
  assert.match(visualRuntime, /\.\/folderDockContract\.css/)
  assert.match(legacyGate, /<OrganicWorkspaceRuntime \/>/)
  assert.match(legacyGate, /<V383WorkspaceVisualRuntime \/>/)
  assert.doesNotMatch(main, /features\/notes\/v383WorkspaceVisual\.css/)
  const visualIndex = visualRuntime.indexOf("./v383WorkspaceVisual.css")
  const dockIndex = visualRuntime.indexOf("./folderDockContract.css")
  assert.ok(visualIndex >= 0 && dockIndex > visualIndex)
})
