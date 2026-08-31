import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const createRuntime = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const createCss = readFileSync('src/features/folders/folderCreation.css', 'utf8')
const dragRuntime = readFileSync('src/features/folders/FolderMobileDragRuntime.tsx', 'utf8')
const desktopDragRuntime = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const dragCss = readFileSync('src/features/folders/folderMobileDrag.css', 'utf8')
const folderService = readFileSync('src/features/folders/folderService.ts', 'utf8')

test('rebuild startup applies no legacy workspace class before the first React paint', () => {
  const render = main.indexOf("createRoot(document.getElementById('root')!).render")
  assert.ok(render >= 0)
  assert.doesNotMatch(main, /oanix-v383-visual|oanix-workspace-v2-active|WORKSPACE_V2_ENABLED/)
})

test('historical folder runtimes stay detached while the rebuild owns unlocked mobile UI', () => {
  assert.doesNotMatch(main, /WorkspaceRuntimeGate/)
  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /<WorkspaceRuntimeGate/)
  assert.doesNotMatch(gate, /MutationObserver/)
  assert.doesNotMatch(gate, /document\.querySelector/)
  assert.match(legacyGate, /<OrganicWorkspaceRuntime \/>/)
  assert.doesNotMatch(legacyGate, /FolderAppearanceRuntime|FolderCustomizerBridgeRuntime/)
  assert.match(legacyGate, /<FolderScopedManagerRuntime \/>/)
  assert.match(legacyGate, /<FolderMobileDragRuntime \/>/)
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
  assert.match(createRuntime, /createFolder\(normalizedName\)/)
  assert.match(createRuntime, /oanix:open-folder-creator/)
})

test('mobile folder long press stays armed at the threshold and uses live horizontal placement', () => {
  assert.match(dragRuntime, /const LONG_PRESS_MS = 220/)
  assert.match(dragRuntime, /const PRESS_ARM_GRACE_MS = 35/)
  assert.match(dragRuntime, /const MOVE_CANCEL_PX = 14/)
  assert.match(dragRuntime, /if \(event\.pointerType === 'mouse' \|\| event\.button !== 0 \|\| gesture\) return/)
  assert.match(dragRuntime, /heldFor >= LONG_PRESS_MS - PRESS_ARM_GRACE_MS/)
  assert.match(dragRuntime, /beginDrag\(\)[\s\S]*gesture\?\.dragging/)
  assert.match(dragRuntime, /siblings\.find\(\(item\) => \{[\s\S]*gesture\.lastX < rect\.left \+ rect\.width \/ 2/)
  assert.match(dragRuntime, /insertBefore\(gesture\.item, insertionTarget\)/)
  assert.match(dragRuntime, /function endAnchor\(rail: HTMLElement\)/)
  assert.match(dragRuntime, /insertBefore\(gesture\.item, endAnchor\(gesture\.rail\)\)/)
  assert.doesNotMatch(dragRuntime, /appendChild\(gesture\.item\)/)
  assert.doesNotMatch(dragRuntime, /clientY > rect\.top \+ rect\.height \/ 2/)
})

test('mobile folder cancel restores folders before the add control', () => {
  assert.match(dragRuntime, /const anchor = endAnchor\(rail\)/)
  assert.match(dragRuntime, /if \(item\) rail\.insertBefore\(item, anchor\)/)
})

test('mobile folder reflow leaves the held source transform to its drag state', () => {
  assert.match(dragRuntime, /function animateReflow\(rail: HTMLElement, before: Map<HTMLElement, DOMRect>, source: HTMLElement\)/)
  assert.match(dragRuntime, /if \(item === source\) continue/)
  assert.match(dragRuntime, /animateReflow\(gesture\.rail, beforeRects, gesture\.item\)/)
  assert.match(dragCss, /oanix-mobile-folder-drag-source[\s\S]*transform:\s*scale\(\.97\)\s*!important/)
})

test('desktop folder drag uses horizontal placement and one exact-order persistence', () => {
  assert.match(desktopDragRuntime, /const placeAfter = event\.clientX > rect\.left \+ rect\.width \/ 2/)
  assert.match(desktopDragRuntime, /queueFolderOrderPersistence\(data\.folders\.map\(\(folder\) => folder\.id\)\)/)
  assert.match(desktopDragRuntime, /const persisted = await persistFolderOrder\(orderToPersist\)/)
  assert.match(desktopDragRuntime, /pendingFolderOrderRef/)
  assert.doesNotMatch(desktopDragRuntime, /customBusy \|\| orderingBusy/)
  assert.doesNotMatch(desktopDragRuntime, /reorderFolder\(/)
  assert.doesNotMatch(desktopDragRuntime, /while\s*\(remaining/)
})

test('edge auto-scroll is continuous but does not launch heavy reflow animation every frame', () => {
  assert.match(dragRuntime, /const EDGE_SCROLL_PX = 72/)
  assert.match(dragRuntime, /const MAX_SCROLL_PER_FRAME = 10/)
  assert.match(dragRuntime, /requestAnimationFrame\(tick\)/)
  assert.match(dragRuntime, /scrollLeft \+= speed/)
  assert.match(dragRuntime, /reorderDomAtPoint\(gesture, false\)/)
  assert.match(dragRuntime, /oanix:folder-order-preview/)
  assert.doesNotMatch(dragRuntime, /persistFolderOrder/)
  assert.match(desktopDragRuntime, /window\.addEventListener\('oanix:folder-order-preview'/)
  assert.match(desktopDragRuntime, /queueFolderOrderPersistence\(orderedIds\)/)
  assert.match(dragCss, /touch-action:\s*none\s*!important/)
})

test('final folder order is persisted with one repository write instead of one write per position', () => {
  const functionStart = folderService.indexOf('export async function persistFolderOrder')
  assert.ok(functionStart >= 0)
  const functionBody = folderService.slice(functionStart)
  assert.match(functionBody, /await saveFolderOrder\(nextIds\)/)
  assert.doesNotMatch(dragRuntime, /persistFolderOrder|reorderFolder\(/)
  assert.match(desktopDragRuntime, /const persisted = await persistFolderOrder\(orderToPersist\)/)
  assert.doesNotMatch(dragRuntime, /while\s*\(remaining/)
})
