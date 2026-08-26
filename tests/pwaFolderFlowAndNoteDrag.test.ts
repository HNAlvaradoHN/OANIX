import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const folderAppearance = readFileSync('src/features/folders/FolderAppearanceRuntime.tsx', 'utf8')
const polishRuntime = readFileSync('src/app/WorkspaceQuickPolishRuntime.tsx', 'utf8')
const polishCss = readFileSync('src/app/workspaceQuickPolish.css', 'utf8')
const noteDragRuntime = readFileSync('src/features/notes/NoteListReorderGestureRuntime.tsx', 'utf8')
const noteDragCss = readFileSync('src/features/notes/noteReorderGesture.css', 'utf8')

test('folder appearance stays save-only and closes the whole customizer after save', () => {
  assert.match(folderAppearance, /oanix-folder-customizer__appearance-toggle/)
  assert.match(folderAppearance, /appearance\.hidden = false/)
  assert.match(folderAppearance, /actions\.hidden = true/)
  assert.match(folderAppearance, /Promise\.all\(\[/)
  assert.match(folderAppearance, /closeCustomizerFromBackdrop\(\)/)
  assert.equal(
    folderAppearance.includes("backdrop.dispatchEvent(new PointerEvent('pointerdown'"),
    true,
  )
  assert.doesNotMatch(folderAppearance, /actions\.hidden = false/)
  assert.doesNotMatch(polishRuntime, /MutationObserver|oanix-folder-customizer__appearance-toggle/)
})

test('coarse touch note drag owns vertical movement after long press without stealing normal pre-drag scroll', () => {
  assert.match(noteDragRuntime, /document\.addEventListener\('touchmove', onNativeTouchMove, \{ capture: true, passive: false \}\)/)
  assert.match(noteDragRuntime, /if \(!touchGesture\.dragging\)[\s\S]*distance < TOUCH_MOVE_CANCEL_PX[\s\S]*heldFor >= LONG_PRESS_MS - PRESS_ARM_GRACE_MS/)
  assert.match(noteDragRuntime, /if \(nativeTouchEvents && event\.pointerType === 'touch'\) return/)
  assert.match(noteDragRuntime, /advanceGesture\(touch\.clientX, touch\.clientY, \(\) => event\.preventDefault\(\)\)/)
  assert.match(noteDragRuntime, /completeGesture\(\(\) => event\.preventDefault\(\)\)/)
  assert.match(noteDragCss, /touch-action:\s*pan-y\s*!important/)
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
