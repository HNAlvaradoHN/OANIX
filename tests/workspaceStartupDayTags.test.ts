import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')
const folderCreator = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const tagCreator = readFileSync('src/features/tags/TagCreationRuntime.tsx', 'utf8')
const tagService = readFileSync('src/features/tags/tagService.ts', 'utf8')
const tagTypes = readFileSync('src/features/tags/tagTypes.ts', 'utf8')
const refinements = readFileSync('src/features/notes/workspaceRefinements.css', 'utf8')

test('folder creation only intercepts the real folder manager dialog', () => {
  assert.match(folderCreator, /aria-label=\\?"Administrar carpetas\\?"/)
  assert.doesNotMatch(folderCreator, /querySelector<HTMLElement>\('\.folder-dialog'\)/)
})

test('workspace no longer blocks behind a fake boot screen and reserves the tag rail from first frame', () => {
  assert.doesNotMatch(main, /WorkspaceBootRuntime/)
  assert.match(refinements, /notes-sidebar:not\(:has\(\.oanix-organic-tags-host\)\) \.notes-list[\s\S]*margin-top:\s*62px !important/)
})

test('top tag plus owns professional tag creation with persisted icon and color after unlock', () => {
  assert.match(main, /<WorkspaceRuntimeGate \/>/)
  assert.match(gate, /<TagCreationRuntime \/>/)
  assert.match(tagCreator, /Nueva etiqueta/)
  assert.match(tagCreator, /TAG_ICON_OPTIONS/)
  assert.match(tagCreator, /TAG_COLOR_OPTIONS/)
  assert.match(tagCreator, /createTag\(normalized, \{ icon, color \}\)/)
  assert.match(tagCreator, /data-oanix-tag-icon|oanixTagIcon/)
  assert.match(tagCreator, /--oanix-tag-color/)
  assert.match(tagService, /icon:\s*appearance\.icon \|\| DEFAULT_TAG_ICON/)
  assert.match(tagService, /color:\s*appearance\.color \|\| DEFAULT_TAG_COLOR/)
  assert.match(tagTypes, /icon\?: string/)
  assert.match(tagTypes, /color\?: string/)
})

test('day mode uses the same folder background stack as night while keeping light surfaces', () => {
  assert.match(main, /workspaceStateContract\.css[\s\S]*workspaceRefinements\.css/)
  assert.match(refinements, /--v383-card:\s*rgba\(232,237,243,\.84\)/)
  assert.doesNotMatch(refinements, /235,121,112|232,111,104|236,116,105/)
  assert.match(refinements, /classic-day[\s\S]*body \.notes-shell,[\s\S]*body \.notes-sidebar[\s\S]*background:\s*transparent !important[\s\S]*background-image:\s*none !important/)
  assert.match(refinements, /classic-day[\s\S]*oanix-organic-background\.oanix-organic-background--covered::before[\s\S]*brightness\(\.42\) saturate\(\.88\)/)
  assert.match(refinements, /classic-day[\s\S]*oanix-organic-background\.oanix-organic-background--covered::after[\s\S]*rgba\(2,6,23,\.20\)[\s\S]*var\(--oanix-organic-cover-image\)/)
  assert.match(refinements, /\.notes-header[\s\S]*background:\s*rgba\(226,232,240,\.62\)/)
  assert.match(refinements, /\.oanix-organic-tags-host[\s\S]*backdrop-filter:\s*blur\(18px\)/)
  assert.match(refinements, /oanix-note-detail-open \.note-view__header \.back-button[\s\S]*display:\s*inline-flex !important/)
  assert.match(refinements, /\.back-button::after[\s\S]*content:\s*'Volver'/)
  assert.match(refinements, /\.tag-assign-empty button[\s\S]*display:\s*none !important/)
})
