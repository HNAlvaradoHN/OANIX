import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('note metadata supports stable order and soft card customization without changing body format', () => {
  const model = readFileSync('src/features/rebuild/rebuildModel.ts', 'utf8')
  const service = readFileSync('src/features/rebuild/rebuildService.ts', 'utf8')

  assert.match(model, /order\?: number/)
  assert.match(model, /cardColor\?: string \| null/)
  assert.match(model, /cardIcon\?: string \| null/)
  assert.match(model, /export function noteHomeOrder\(note: NoteV2Meta\)/)
  assert.match(service, /export async function saveRebuildNoteCard/)
  assert.match(service, /export async function saveRebuildNoteOrder/)
  assert.match(service, /createPendingSyncWrite/)
})

test('note card customization uses a low-impact visual dialog with icon and color choices', () => {
  const dialog = readFileSync('src/features/rebuild/NoteCardCustomizationDialog.tsx', 'utf8')
  const css = readFileSync('src/features/rebuild/noteCardCustomizationDialog.css', 'utf8')
  const listCss = readFileSync('src/features/rebuild/noteListSection.css', 'utf8')

  assert.match(dialog, /Personalizar tarjeta/)
  assert.match(dialog, /Icono propio/)
  assert.match(dialog, /Color suave/)
  assert.match(dialog, /V2_FOLDER_ICONS/)
  assert.match(dialog, /V2_FOLDER_GRADIENTS/)
  assert.match(css, /note-card-customization__colors/)
  assert.match(listCss, /var\(--note-card-accent\) 8%/)
  assert.match(listCss, /\[data-oanix-theme-mode="light"\]/)
})

test('only the complete Home note list exposes stable move controls while filters, search and recents keep their own ordering', () => {
  const app = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
  const list = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')

  assert.match(app, /<NoteListSection/)
  assert.match(app, /canReorder=\{\s*viewMode === 'home'\s*&& activeFolderId === null\s*&& activeTagId === null\s*&& query\.trim\(\)\.length === 0\s*\}/)
  assert.match(app, /saveRebuildNoteOrder/)
  assert.match(app, /Math\.min\(\.\.\.notes\.map\(\(note\) => noteHomeOrder\(note\)\)\) - 1/)
  assert.match(list, /noteHomeOrder\(left\) - noteHomeOrder\(right\)/)
  assert.match(list, /aria-label=\{`Subir/)
  assert.match(list, /aria-label=\{`Bajar/)
  assert.match(list, /onCustomize\(note\)/)
})

test('a failed second move attempts to restore the first note order instead of leaving a silent half-swap', () => {
  const app = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')

  assert.match(app, /updatedFirst = await saveRebuildNoteOrder\(first, secondOrder\)/)
  assert.match(app, /const updatedSecond = await saveRebuildNoteOrder\(second, firstOrder\)/)
  assert.match(app, /saveRebuildNoteOrder\(updatedFirst, firstOrder\)/)
  assert.match(app, /loadRebuildWorkspace\(\)/)
})
