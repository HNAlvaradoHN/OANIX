import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')
const wrapper = readFileSync('src/features/editor/implementations/OanixMixedDocumentWithFiles.tsx', 'utf8')
const card = readFileSync('src/features/editor/implementations/OanixSeparatorBlockCard.tsx', 'utf8')
const projection = readFileSync('src/features/editor/oanixMixedDocumentProjection.ts', 'utf8')

test('Separador menu action inserts through the transactional separator layer', () => {
  assert.match(surface, /import \{ insertOanixSeparatorBlock \} from '\.\.\/oanixSeparatorBlockLayer'/)
  assert.match(surface, /if \(tool === 'separator'\) void insertSeparatorBlockFromMenu\(\)/)
  assert.match(surface, /insertOanixSeparatorBlock\(\{[\s\S]*mode: 'plain'/)
  assert.match(surface, /insertOanixSeparatorBlock\(\{[\s\S]*mode: 'mixed'/)
  assert.match(surface, /focusAfterInsertedElement\(result\.plan\.separatorBlockId, result\.plan\.afterTextBlockId\)/)
})

test('separator is composed and recognized after reopening a mixed note', () => {
  assert.match(wrapper, /decodeSeparatorBlock/)
  assert.match(wrapper, /OanixSeparatorBlockCard/)
  assert.match(wrapper, /onRemoveSeparatorBlock/)
  assert.match(projection, /type: 'separator'/)
  assert.match(projection, /decodeSeparatorBlock/)
})

test('separator card is structural, full-width and removable without editable payload', () => {
  assert.match(card, /data-oanix-element-kind="separator"/)
  assert.match(card, /oanix-separator-block__line/)
  assert.match(card, /Eliminar este separador/)
  assert.doesNotMatch(card, /<input|<textarea/)
})

test('separator structural operations are durable and participate in busy state', () => {
  assert.match(surface, /async function removeSeparatorBlock\(blockId: string\)/)
  assert.match(surface, /onRemoveSeparatorBlock=\{removeSeparatorBlock\}/)
  assert.match(surface, /const \[separatorBusy, setSeparatorBusy\] = useState\(false\)/)
  assert.match(surface, /editingDisabled = saving \|\| closing \|\| imageBusy \|\| fileBusy \|\| codeBusy \|\| checklistBusy \|\| contactBusy \|\| separatorBusy/)
  assert.match(surface, /Guardando separador…/)
})
