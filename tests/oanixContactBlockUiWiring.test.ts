import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')
const wrapper = readFileSync('src/features/editor/implementations/OanixMixedDocumentWithFiles.tsx', 'utf8')
const card = readFileSync('src/features/editor/implementations/OanixContactBlockCard.tsx', 'utf8')
const projection = readFileSync('src/features/editor/oanixMixedDocumentProjection.ts', 'utf8')

test('Contacto menu action inserts through the transactional contact layer', () => {
  assert.match(surface, /import \{ insertOanixContactBlock \} from '\.\.\/oanixContactBlockLayer'/)
  assert.match(surface, /if \(tool === 'contact'\) void insertContactBlockFromMenu\(\)/)
  assert.match(surface, /insertOanixContactBlock\(\{[\s\S]*mode: 'plain'/)
  assert.match(surface, /insertOanixContactBlock\(\{[\s\S]*mode: 'mixed'/)
  assert.match(surface, /focusAfterInsertedElement\(result\.plan\.contactBlockId, result\.plan\.afterTextBlockId\)/)
})

test('contact is composed and recognized when reopening a mixed note', () => {
  assert.match(wrapper, /decodeContactBlock/)
  assert.match(wrapper, /OanixContactBlockCard/)
  assert.match(wrapper, /onRemoveContactBlock/)
  assert.match(projection, /type: 'contact'/)
  assert.match(projection, /decodeContactBlock/)
})

test('contact card edits private fields and exposes phone and email actions', () => {
  assert.match(card, /type="tel"/)
  assert.match(card, /type="email"/)
  assert.match(card, /Organización/)
  assert.match(card, /Notas/)
  assert.match(card, /href=\{`tel:/)
  assert.match(card, /href=\{`mailto:/)
  assert.match(card, /Eliminar esta tarjeta de contacto/)
})

test('contact structural operations are durable and participate in busy state', () => {
  assert.match(surface, /async function removeContactBlock\(blockId: string\)/)
  assert.match(surface, /onRemoveContactBlock=\{removeContactBlock\}/)
  assert.match(surface, /const \[contactBusy, setContactBusy\] = useState\(false\)/)
  assert.match(surface, /editingDisabled = saving \|\| closing \|\| imageBusy \|\| fileBusy \|\| codeBusy \|\| checklistBusy \|\| contactBusy/)
  assert.match(surface, /Guardando contacto…/)
})
