import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const createRuntime = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const createCss = readFileSync('src/features/folders/folderCreation.css', 'utf8')
const dragRuntime = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')
const dragCss = readFileSync('src/features/folders/folderMobileDrag.css', 'utf8')
const folderService = readFileSync('src/features/folders/folderService.ts', 'utf8')

test('approved workspace class is present before the first React paint', () => {
  const marker = main.indexOf("document.documentElement.classList.add('oanix-v383-visual')")
  const render = main.indexOf("createRoot(document.getElementById('root')!).render")
  assert.ok(marker >= 0 && render > marker)
  assert.match(main, /document\.body\.classList\.add\('oanix-v383-visual'\)/)
})

test('legacy folder manager is visually replaced by the focused Nueva carpeta dialog', () => {
  assert.match(createCss, /\.folder-dialog[\s\S]*display:\s*none\s*!important/)
  assert.match(createRuntime, /<strong>Nueva carpeta<\/strong>/)
  assert.match(createRuntime, /<span>NOMBRE<\/span>/)
  assert.match(createRuntime, /<legend>COLOR<\/legend>/)
  assert.match(createRuntime, /<legend>ICONO<\/legend>/)
  assert.match(createRuntime, />Cancelar<\/button>/)
  assert.match(createRuntime, /saveFolderColor\(created\.id, color\)/)
  assert.match(createRuntime, /saveFolderIcon\(created\.id, icon\)/)
  assert.match(createRuntime, /\.notes-create-fab, \.empty-action/)
})

test('mobile folder long press uses live horizontal placement and continuous edge scrolling', () => {
  assert.match(dragRuntime, /const LONG_PRESS_MS = 340/)
  assert.match(dragRuntime, /siblings\.find\(\(item\) => \{[\s\S]*gesture\.lastX < rect\.left \+ rect\.width \/ 2/)
  assert.match(dragRuntime, /insertBefore\(gesture\.item, insertionTarget\)/)
  assert.match(dragRuntime, /appendChild\(gesture\.item\)/)
  assert.doesNotMatch(dragRuntime, /clientY > rect\.top \+ rect\.height \/ 2/)
  assert.match(dragRuntime, /requestAnimationFrame\(tick\)/)
  assert.match(dragRuntime, /scrollLeft \+= speed/)
  assert.match(dragRuntime, /persistFolderOrder\(nextOrder\)/)
  assert.match(dragCss, /touch-action:\s*none\s*!important/)
})

test('final folder order is persisted with one repository write instead of one write per position', () => {
  const functionStart = folderService.indexOf('export async function persistFolderOrder')
  assert.ok(functionStart >= 0)
  const functionBody = folderService.slice(functionStart)
  assert.match(functionBody, /await saveFolderOrder\(nextIds\)/)
  assert.doesNotMatch(dragRuntime, /reorderFolder\(/)
  assert.doesNotMatch(dragRuntime, /while\s*\(remaining/)
})
