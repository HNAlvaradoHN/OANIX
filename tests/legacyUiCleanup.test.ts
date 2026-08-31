import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const indexHtml = readFileSync('index.html', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const workspaceGate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

const retiredPaths = [
  'public/folder-vertical-slider.css',
  'public/folder-card-approved.css',
  'src/features/folders/FolderTiltRuntime.tsx',
  'src/features/editor/NotebookCanvasRuntime.tsx',
  'src/features/editor/NotebookFreeRowsRuntime.tsx',
  'src/features/editor/NotebookSimpleImageRuntime.tsx',
  'src/styles/notebook-canvas.css',
  'src/styles/notebook-logical-rows-v6.css',
] as const

test('retired folder presentation layers are no longer loaded before React', () => {
  assert.doesNotMatch(indexHtml, /folder-vertical-slider\.css/)
  assert.doesNotMatch(indexHtml, /folder-card-approved\.css/)
})

test('retired notebook experiments and the hidden-view tilt runtime are physically absent', () => {
  retiredPaths.forEach((path) => assert.equal(existsSync(path), false, `${path} should stay removed`))
  assert.doesNotMatch(workspaceGate, /FolderTiltRuntime/)
})

test('rebuild owns the unlocked lifecycle while historical workspace runtimes stay detached', () => {
  assert.doesNotMatch(main, /WorkspaceRuntimeGate/)
  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /<WorkspaceRuntimeGate/)
  assert.doesNotMatch(workspaceGate, /MutationObserver/)
  assert.doesNotMatch(workspaceGate, /document\.querySelector/)
})
