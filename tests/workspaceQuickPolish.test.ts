import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const runtime = readFileSync('src/app/WorkspaceQuickPolishRuntime.tsx', 'utf8')
const css = readFileSync('src/app/workspaceQuickPolish.css', 'utf8')

test('quick polish stays presentation-only and needs no folder observer', () => {
  assert.doesNotMatch(runtime, /removeRedundantFolderOpenAction|MutationObserver/)
})

test('saving note personalization closes the originating three-dot row menu', () => {
  assert.match(runtime, /oanix:note-visual-changed/)
  assert.match(runtime, /\.note-row__menu-button\[aria-expanded="true"\]/)
  assert.match(runtime, /opener\?\.click\(\)/)
})

test('compact icon controls use explicit centering without inherited padding drift', () => {
  for (const selector of [
    '.oanix-folder-card__gear',
    '.oanix-organic-folder-control',
    '.note-row__menu-button',
    '.note-view__menu-button',
    '.notes-header .icon-button',
    '.notes-header .account-header-action',
    '.oanix-note-customizer__header button',
  ]) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(css, /align-items:\s*center !important/)
  assert.match(css, /justify-content:\s*center !important/)
  assert.match(css, /\.notes-header \.icon-button[\s\S]*padding:\s*0 !important/)
  assert.match(css, /> svg[\s\S]*margin:\s*auto/)
})

test('quick polish remains mounted without the retired folder appearance runtime', () => {
  assert.match(legacyGate, /<WorkspaceQuickPolishRuntime \/>/)
  assert.doesNotMatch(legacyGate, /FolderAppearanceRuntime/)
})
