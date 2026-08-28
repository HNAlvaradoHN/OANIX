import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/notes/WorkspaceV2TagActions.tsx', 'utf8')
const sidebar = readFileSync('src/features/notes/WorkspaceV2Sidebar.tsx', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')

test('workspace v2 tag plus exposes exactly add and delete actions', () => {
  const menu = source.match(/role="menu" aria-label="Acciones de etiquetas">([\s\S]*?)<\/div>/)?.[1] ?? ''
  assert.ok(menu, 'missing v2 tag actions menu')
  assert.match(menu, />\s*Agregar etiqueta\s*</)
  assert.match(menu, />\s*Eliminar etiqueta\s*</)
  assert.equal((menu.match(/role="menuitem"/g) ?? []).length, 2)
})

test('workspace v2 tag creation preserves icon and color through the real service callback', () => {
  assert.match(source, /TAG_ICON_OPTIONS/)
  assert.match(source, /TAG_COLOR_OPTIONS/)
  assert.match(source, /await onCreate\(normalized, \{ icon, color \}\)/)
  assert.match(sidebar, /<WorkspaceV2TagActions[\s\S]*onCreate=\{onCreateTag\}[\s\S]*onDelete=\{onDeleteTag\}/)
  assert.match(workspace, /const tag = await createTag\(normalized, appearance\)/)
})

test('workspace v2 deletion delegates to the existing note-safe tag deletion handler', () => {
  assert.match(workspace, /onDeleteTag=\{handleDeleteTag\}/)
  assert.match(source, /await onDelete\(tag\)/)
})


test('workspace v2 tag dialogs portal above the workspace and consume mobile back before app exit', () => {
  assert.match(source, /createPortal/)
  assert.match(source, /TAG_DIALOG_HISTORY_KEY = 'oanixWorkspaceV2TagDialog'/)
  assert.match(source, /window\.history\.pushState/)
  assert.match(source, /window\.history\.back\(\)/)
  assert.match(source, /window\.addEventListener\('popstate', handlePopState\)/)
  assert.match(source, /oanix-workspace-v2__modal--tag/)
})
