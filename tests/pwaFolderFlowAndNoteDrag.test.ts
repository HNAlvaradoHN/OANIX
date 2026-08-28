import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const folderGrid = readFileSync('src/features/folders/FolderGridRuntime.tsx', 'utf8')
const folderFeedback = readFileSync('src/features/folders/FolderOperationFeedbackRuntime.tsx', 'utf8')
const folderFeedbackCss = readFileSync('src/features/folders/folderOperationFeedback.css', 'utf8')
const polishRuntime = readFileSync('src/app/WorkspaceQuickPolishRuntime.tsx', 'utf8')
const polishCss = readFileSync('src/app/workspaceQuickPolish.css', 'utf8')
const folderDockCss = readFileSync('src/features/notes/folderDockContract.css', 'utf8')
const noteDragRuntime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const noteDragCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('folder appearance stays draft-only until one explicit React save', () => {
  assert.match(folderGrid, /customAppearanceOpen/)
  assert.match(folderGrid, /customDraftColor/)
  assert.match(folderGrid, /customDraftIcon/)
  assert.match(folderGrid, /Promise\.all\(\[/)
  assert.match(folderGrid, /oanix:folder-appearance-saved/)
  assert.match(folderGrid, /setCustomFolder\(null\)/)
  assert.doesNotMatch(folderGrid, /document\.createElement/)
  assert.doesNotMatch(folderFeedback, /pendingSelection|restoreFolderIcon|aria-busy/)
  assert.match(folderFeedback, /oanix:folder-appearance-saved/)
  assert.match(folderFeedback, /✓ Guardado/)
  assert.doesNotMatch(polishRuntime, /MutationObserver|oanix-folder-customizer__appearance-toggle/)
})

test('coarse touch note drag owns vertical movement with one pointer engine and manual pre-drag scroll', () => {
  assert.match(noteDragRuntime, /document\.addEventListener\('pointermove', onTouchPointerMove, \{ capture: true, passive: false \}\)/)
  assert.match(noteDragRuntime, /if \(!touchGesture\.dragging\)[\s\S]*distance < TOUCH_MOVE_CANCEL_PX[\s\S]*heldFor >= LONG_PRESS_MS - PRESS_ARM_GRACE_MS/)
  assert.match(noteDragRuntime, /event\.pointerType === 'mouse'/)
  assert.match(noteDragRuntime, /list\.scrollTop -= fingerDeltaY/)
  assert.match(noteDragRuntime, /startScrollMomentum\(finished\.scrollVelocityY\)/)
  assert.match(noteDragRuntime, /window\.scrollTo\(0, touchGesture\.startWindowScrollY - dy\)/)
  assert.match(noteDragRuntime, /setPointerCapture\(touchGesture\.pointerId\)/)
  assert.doesNotMatch(noteDragRuntime, /TouchEvent|onNativeTouch/)
  assert.match(noteDragCss, /touch-action:\s*none\s*!important/)
})

test('folder gear uses the centered vector-mask authority from the folder dock contract', () => {
  assert.match(folderDockCss, /\.oanix-folder-card__gear[\s\S]*left:\s*50%\s*!important[\s\S]*transform:\s*translateX\(-50%\)\s*!important/)
  assert.match(folderDockCss, /\.oanix-folder-card__gear::before[\s\S]*mask-image:/)
  assert.match(polishCss, /align-items:\s*center/)
  assert.match(polishCss, /justify-content:\s*center/)
  assert.doesNotMatch(polishCss, /\.oanix-folder-card__gear::before/)
  assert.doesNotMatch(polishCss, /\.oanix-folder-card__gear\s*\{[\s\S]*font-size:\s*0\s*!important/)
})

test('desktop note drag does not detach a legacy fallback card to body', () => {
  assert.match(noteDragRuntime, /forceFallback: false/)
  assert.match(noteDragRuntime, /fallbackOnBody: false/)
  assert.doesNotMatch(noteDragCss, /body\s*>\s*\.note-row\.oanix-mobile-note-drag-ghost/)
  assert.match(noteDragCss, /.notes-shell > \.note-row\.oanix-mobile-note-drag-overlay/)
})
