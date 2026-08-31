import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const themeVisualStyles = readFileSync('src/app/ThemeVisualStyles.ts', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const runtime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')
const personalization = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')

test('legacy v38.3 layer remains preserved but detached from the active rebuild', () => {
  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /<WorkspaceRuntimeGate/)
  assert.match(legacyGate, /<V383WorkspaceVisualRuntime \/>/)
  assert.match(runtime, /classList\.add\('oanix-v383-visual'\)/)
  assert.doesNotMatch(main, /\.\/styles\/header-icon-polish\.css/)
  assert.match(main, /\.\/app\/ThemeVisualStyles/)
  assert.match(themeVisualStyles, /\.\.\/styles\/notebook-contract\.css/)
  assert.doesNotMatch(main, /\.\/styles\/notebook-contract\.css/)
  assert.doesNotMatch(main, /\.\/styles\/notebook-polish\.css/)
  assert.match(themeVisualStyles, /\.\.\/styles\/classic-theme-surfaces\.css/)
  assert.doesNotMatch(main, /\.\/styles\/classic-theme-surfaces\.css/)

  const notebookIndex = themeVisualStyles.indexOf("../styles/notebook-contract.css")
  const themeSurfaceIndex = themeVisualStyles.indexOf("../styles/classic-theme-surfaces.css")
  const visualIndex = runtime.indexOf("./v383WorkspaceVisual.css")
  const stateIndex = runtime.indexOf("./workspaceStateContract.css")
  const compactIndex = runtime.indexOf("./compactNoteContract.css")
  assert.ok(notebookIndex >= 0)
  assert.ok(themeSurfaceIndex > notebookIndex)
  assert.doesNotMatch(main, /features\/notes\/v383WorkspaceVisual\.css/)
  assert.doesNotMatch(legacyGate, /import ['"]\.\.\/features\/notes\/(?:v383WorkspaceVisual|workspaceStateContract|compactNoteContract)\.css['"]/)
  assert.ok(visualIndex >= 0)
  assert.ok(stateIndex > visualIndex)
  assert.ok(compactIndex > stateIndex)
})

test('approved v38.3 geometry is preserved for notes, chips and folder dock', () => {
  assert.match(css, /\.note-row[\s\S]*min-height: 95px !important/)
  assert.match(css, /\.note-row[\s\S]*margin: -15px 0 0 !important/)
  assert.match(css, /\.note-row::before[\s\S]*width: 56px !important[\s\S]*height: 30px !important/)
  assert.match(css, /\.oanix-organic-tag-chip[\s\S]*padding: 6px 14px !important[\s\S]*border-radius: 16px !important/)
  assert.match(css, /\.oanix-folder-grid[\s\S]*height: calc\(135px \+ env\(safe-area-inset-bottom\)\) !important/)
  assert.match(css, /\.oanix-organic-folder-controls[\s\S]*width: 52px !important[\s\S]*height: 90px !important/)
  assert.match(css, /\.notes-create-fab[\s\S]*width: 50px !important[\s\S]*height: 50px !important/)
})

test('day and night share the same workspace geometry and one bottom theme control', () => {
  assert.match(css, /color-scheme: light only !important/)
  assert.match(css, /data-oanix-theme='classic-night'/)
  assert.match(personalization, /dataset\.oanixThemeToggle = 'true'/)
  assert.match(personalization, /applyOanixTheme\(current === 'classic-day' \? 'classic-night' : 'classic-day'\)/)
  assert.match(css, /\.oanix-organic-folder-control\[data-oanix-theme-toggle='true'\]/)
})

test('mobile uses the same shell rather than a separate application presentation', () => {
  assert.match(css, /@media \(max-width:760px\)/)
  assert.match(css, /\.notes-shell\.notes-shell--open > \.note-view/)
  assert.match(css, /100dvh/)
  assert.match(css, /env\(safe-area-inset-bottom\)/)
  assert.match(css, /touch-action: pan-x !important/)
})
