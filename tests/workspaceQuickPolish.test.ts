import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const runtime = readFileSync('src/app/WorkspaceQuickPolishRuntime.tsx', 'utf8')
const css = readFileSync('src/app/workspaceQuickPolish.css', 'utf8')

test('quick polish removes the redundant open-folder action from the unified customizer', () => {
  assert.match(runtime, /\.oanix-folder-customizer__open-action/)
  assert.match(runtime, /\.forEach\(\(button\) => button\.remove\(\)\)/)
  assert.match(runtime, /new MutationObserver\(removeRedundantFolderOpenAction\)/)
})

test('saving note personalization closes the originating three-dot row menu', () => {
  assert.match(runtime, /oanix:note-visual-changed/)
  assert.match(runtime, /\.note-row__menu-button\[aria-expanded="true"\]/)
  assert.match(runtime, /opener\?\.click\(\)/)
})

test('compact folder and menu controls use explicit centering', () => {
  assert.match(css, /\.oanix-folder-card__gear[\s\S]*align-items:\s*center !important/)
  assert.match(css, /justify-content:\s*center !important/)
  assert.match(css, /\.note-row__menu-button/)
})

test('quick polish runtime is mounted after folder appearance', () => {
  const appearanceIndex = gate.indexOf('<FolderAppearanceRuntime />')
  const polishIndex = gate.indexOf('<WorkspaceQuickPolishRuntime />')
  assert.ok(appearanceIndex >= 0 && polishIndex > appearanceIndex)
})
