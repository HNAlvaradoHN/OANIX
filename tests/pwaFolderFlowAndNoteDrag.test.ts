import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const folderAppearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')
const folderFeedback = readFileSync('src/features/folders/FolderOperationFeedbackRuntime.tsx', 'utf8')
const folderFeedbackCss = readFileSync('src/features/folders/folderOperationFeedback.css', 'utf8')
const polishRuntime = readFileSync('src/app/WorkspaceQuickPolishRuntime.tsx', 'utf8')
const polishCss = readFileSync('src/app/workspaceQuickPolish.css', 'utf8')
const noteDragRuntime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const noteDragCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('folder appearance stays preview-only until save and closes the whole customizer', () => {
  assert.match(folderAppearance, /oanix-folder-customizer__appearance-toggle/)
  assert.match(folderAppearance, /appearance\.hidden = false/)
  assert.match(folderAppearance, /actions\.hidden = true/)
  assert.match(folderAppearance, /Promise\.all\(\[/)
  assert.match(folderAppearance, /saveAppearance\.textContent = '✓ Guardado'/)
  assert.match(folderAppearance, /oanix:folder-appearance-saved/)
  assert.match(folderAppearance, /cancelButton\?\.click\(\)/)
  assert.doesNotMatch(folderAppearance, /closeCustomizerFromBackdrop/)
  assert.doesNotMatch(folderFeedback, /collapseAppearancePicker\(/)
  assert.doesNotMatch(folderFeedback, /✓ Color guardado|✓ Icono guardado|Vista previa aplicada/)
  assert.doesNotMatch(folderFeedback, /pendingSelection|restoreFolderIcon|aria-busy/)
  assert.match(folderFeedback, /oanix:folder-appearance-saved/)
  assert.match(folderFeedback, /✓ Guardado/)
  assert.match(folderFeedbackCss, /\.oanix-folder-customizer__actions\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important/)
  assert.doesNotMatch(polishRuntime, /MutationObserver|oanix-folder-customizer__appearance-toggle/)
})

test('coarse touch note drag owns vertical movement with one pointer engine and manual pre-drag scroll', () => {
  assert.match(noteDragRuntime, /document\.addEventListener\('pointermove', onTouchPointerMove, \{ capture: true, passive: false \}\)/)
  assert.match(noteDragRuntime, /if \(!touchGesture\.dragging\)[\s\S]*distance < TOUCH_MOVE_CANCEL_PX[\s\S]*heldFor >= LONG_PRESS_MS - PRESS_ARM_GRACE_MS/)
  assert.match(noteDragRuntime, /event\.pointerType === 'mouse'/)
  assert.match(noteDragRuntime, /list\.scrollTop = touchGesture\.startScrollTop - dy/)
  assert.match(noteDragRuntime, /window\.scrollTo\(0, touchGesture\.startWindowScrollY - dy\)/)
  assert.match(noteDragRuntime, /setPointerCapture\(touchGesture\.pointerId\)/)
  assert.doesNotMatch(noteDragRuntime, /TouchEvent|onNativeTouch/)
  assert.match(noteDragCss, /touch-action:\s*none\s*!important/)
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
