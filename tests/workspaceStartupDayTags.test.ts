import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const app = readFileSync('src/app/App.tsx', 'utf8')
const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')
const folderCreator = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const inputCompatibility = readFileSync('src/features/notes/WorkspaceInputCompatibilityRuntime.tsx', 'utf8')
const organic = readFileSync('src/features/notes/OrganicWorkspaceRuntime.tsx', 'utf8')
const tagService = readFileSync('src/features/tags/tagService.ts', 'utf8')
const tagTypes = readFileSync('src/features/tags/tagTypes.ts', 'utf8')
const refinements = readFileSync('src/features/notes/workspaceRefinements.css', 'utf8')
const globalCss = readFileSync('src/styles/global.css', 'utf8')

test('folder creation no longer depends on the legacy folder manager dialog', () => {
  assert.doesNotMatch(folderCreator, /MutationObserver/)
  assert.doesNotMatch(folderCreator, /Administrar carpetas/)
  assert.match(folderCreator, /createFolder\(normalizedName\)/)
  assert.match(folderCreator, /oanix:open-folder-creator/)
  assert.doesNotMatch(folderCreator, /CREATE_TRIGGER_SELECTOR/)
  assert.match(inputCompatibility, /\.notes-tab--add/)
  assert.match(inputCompatibility, /\.oanix-organic-folder-control--add/)
  assert.match(inputCompatibility, /\.oanix-folder-rail__item--add/)
})

test('workspace no longer blocks behind a fake boot screen and reserves the tag rail from first frame', () => {
  assert.doesNotMatch(main, /WorkspaceBootRuntime/)
  assert.match(refinements, /notes-sidebar:not\(:has\(\.oanix-organic-tags-host\)\) \.notes-list[\s\S]*margin-top:\s*62px !important/)
})

test('touch startup keeps large blurred vault ambience static while preserving small core motion', () => {
  assert.match(globalCss, /@media \(pointer: coarse\)[\s\S]*\.vault-shell::after,[\s\S]*\.vault-glow[\s\S]*animation:\s*none/)
  assert.match(globalCss, /\.vault-core__ring--outer[\s\S]*animation:\s*vaultOrbit/)
  assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.vault-core__ring[\s\S]*animation:\s*none !important/)
})

test('legacy tag creation remains preserved while rebuild owns active tag creation', () => {
  assert.match(app, /<RebuildApp onLock=\{lockVault\} \/>/)
  assert.doesNotMatch(app, /<WorkspaceRuntimeGate/)
  assert.doesNotMatch(legacyGate, /TagCreationRuntime/)
  assert.match(organic, /Agregar etiqueta/)
  assert.match(organic, /Eliminar etiqueta/)
  assert.match(organic, /Nueva etiqueta/)
  assert.match(organic, /TAG_ICON_OPTIONS/)
  assert.match(organic, /TAG_COLOR_OPTIONS/)
  assert.match(organic, /createTag\(normalized, \{ icon: tagIcon, color: tagColor \}\)/)
  assert.match(organic, /data-oanix-tag-icon/)
  assert.match(organic, /--oanix-tag-color/)
  assert.match(tagService, /icon:\s*appearance\.icon \|\| DEFAULT_TAG_ICON/)
  assert.match(tagService, /color:\s*appearance\.color \|\| DEFAULT_TAG_COLOR/)
  assert.match(tagTypes, /icon\?: string/)
  assert.match(tagTypes, /color\?: string/)
})

test('day mode uses the same folder background stack as night while keeping light surfaces', () => {
  assert.doesNotMatch(main, /workspaceStateContract\.css|workspaceRefinements\.css/)
  assert.match(visualRuntime, /workspaceStateContract\.css[\s\S]*workspaceRefinements\.css/)
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
