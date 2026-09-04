import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')
const wrapper = readFileSync('src/features/editor/implementations/OanixMixedDocumentWithFiles.tsx', 'utf8')
const card = readFileSync('src/features/editor/implementations/OanixChecklistBlockCard.tsx', 'utf8')
const projection = readFileSync('src/features/editor/oanixMixedDocumentProjection.ts', 'utf8')

test('Checklist menu action inserts through the transactional checklist layer', () => {
  assert.match(surface, /import \{ insertOanixChecklistBlock \} from '\.\.\/oanixChecklistBlockLayer'/)
  assert.match(surface, /if \(tool === 'checklist'\) void insertChecklistBlockFromMenu\(\)/)
  assert.match(surface, /insertOanixChecklistBlock\(\{[\s\S]*mode: 'plain'/)
  assert.match(surface, /insertOanixChecklistBlock\(\{[\s\S]*mode: 'mixed'/)
  assert.match(surface, /focusAfterInsertedElement\(result\.plan\.checklistBlockId, result\.plan\.afterTextBlockId\)/)
})

test('checklist is composed as a first-class mixed document segment', () => {
  assert.match(wrapper, /decodeChecklistBlock/)
  assert.match(wrapper, /OanixChecklistBlockCard/)
  assert.match(wrapper, /onRemoveChecklistBlock/)
  assert.match(projection, /type: 'checklist'/)
  assert.match(projection, /decodeChecklistBlock/)
})

test('checklist supports task editing, toggling, adding, removing and durable block deletion', () => {
  assert.match(card, /type="checkbox"/)
  assert.match(card, /checked=\{item\.checked\}/)
  assert.match(card, /onChange=\{\(event\) => updateItem\(index, \{ checked: event\.currentTarget\.checked \}\)\}/)
  assert.match(card, /if \(event\.key === 'Enter'\)/)
  assert.match(card, /Añadir tarea/)
  assert.match(card, /removeItem\(index\)/)
  assert.match(surface, /async function removeChecklistBlock\(blockId: string\)/)
  assert.match(surface, /onRemoveChecklistBlock=\{removeChecklistBlock\}/)
})

test('checklist structural operations participate in editor busy state', () => {
  assert.match(surface, /const \[checklistBusy, setChecklistBusy\] = useState\(false\)/)
  assert.match(surface, /editingDisabled = saving \|\| closing \|\| imageBusy \|\| fileBusy \|\| codeBusy \|\| checklistBusy/)
  assert.match(surface, /Guardando checklist…/)
})
