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

  assert.match(dialog, /Personalizar tarjeta/)
  assert.match(dialog, /Icono propio/)
  assert.match(dialog, /Color suave/)
  assert.match(dialog, /V2_FOLDER_ICONS/)
  assert.match(dialog, /V2_FOLDER_GRADIENTS/)
  assert.match(css, /note-card-customization__colors/)
})
