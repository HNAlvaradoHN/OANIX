import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const folderCreator = readFileSync('src/features/folders/FolderCreationRuntime.tsx', 'utf8')
const tagCreator = readFileSync('src/features/tags/TagCreationRuntime.tsx', 'utf8')
const boot = readFileSync('src/features/notes/WorkspaceBootRuntime.tsx', 'utf8')
const refinements = readFileSync('src/features/notes/workspaceRefinements.css', 'utf8')

test('folder creation only intercepts the real folder manager dialog', () => {
  assert.match(folderCreator, /aria-label=\\?"Administrar carpetas\\?"/)
  assert.doesNotMatch(folderCreator, /querySelector<HTMLElement>\('\.folder-dialog'\)/)
})

test('workspace boot waits for folders tags background and notes before reveal', () => {
  assert.match(main, /<WorkspaceBootRuntime \/>/)
  assert.match(boot, /loadFolders\(\), loadTags\(\)/)
  assert.match(boot, /oanix-folder-rail__item--all/)
  assert.match(boot, /data-oanix-organic-tag-id/)
  assert.match(boot, /oanix-organic-background/)
  assert.match(boot, /Cargando notas…/)
  assert.match(boot, /finishBoot\(\)/)
})

test('top tag plus owns tag creation and does not fall through to legacy manager', () => {
  assert.match(main, /<TagCreationRuntime \/>/)
  assert.match(tagCreator, /Crear nueva etiqueta/)
  assert.match(tagCreator, /event\.preventDefault\(\)/)
  assert.match(tagCreator, /event\.stopPropagation\(\)/)
  assert.match(tagCreator, /createTag\(normalized\)/)
  assert.match(tagCreator, /oanix:local-data-changed/)
})

test('day mode keeps layered surfaces and desktop note back button is visible', () => {
  assert.match(main, /workspaceStateContract\.css[\s\S]*workspaceRefinements\.css/)
  assert.match(refinements, /--v383-card:\s*rgba\(245,248,252,\.78\)/)
  assert.match(refinements, /\.oanix-organic-tags-host[\s\S]*backdrop-filter:\s*blur\(18px\)/)
  assert.match(refinements, /oanix-note-detail-open \.note-view__header \.back-button[\s\S]*display:\s*grid !important/)
  assert.match(refinements, /\.tag-assign-empty button[\s\S]*display:\s*none !important/)
})
