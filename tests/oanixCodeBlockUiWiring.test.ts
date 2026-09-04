import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')
const wrapper = readFileSync('src/features/editor/implementations/OanixMixedDocumentWithFiles.tsx', 'utf8')
const card = readFileSync('src/features/editor/implementations/OanixCodeBlockCard.tsx', 'utf8')

test('Código menu action inserts through the transactional code block layer', () => {
  assert.match(surface, /import \{ insertOanixCodeBlock \} from '\.\.\/oanixCodeBlockLayer'/)
  assert.match(surface, /if \(tool === 'code'\) void insertCodeBlockFromMenu\(\)/)
  assert.match(surface, /insertOanixCodeBlock\(\{[\s\S]*mode: 'plain'/)
  assert.match(surface, /insertOanixCodeBlock\(\{[\s\S]*mode: 'mixed'/)
  assert.match(surface, /focusAfterInsertedElement\(result\.plan\.codeBlockId, result\.plan\.afterTextBlockId\)/)
})

test('code block is rendered, editable, copyable and durably removable', () => {
  assert.match(wrapper, /decodeCodeBlock/)
  assert.match(wrapper, /OanixCodeBlockCard/)
  assert.match(wrapper, /onRemoveCodeBlock/)
  assert.match(surface, /async function removeCodeBlock\(blockId: string\)/)
  assert.match(surface, /deletes: \[blockId\]/)
  assert.match(surface, /onRemoveCodeBlock=\{removeCodeBlock\}/)
  assert.match(card, /navigator\.clipboard\.writeText/)
  assert.match(card, /Lenguaje del bloque de código/)
  assert.match(card, /Escribe o pega código/)
  assert.match(card, /Eliminar bloque de código/)
})

test('code operations participate in the editor busy state', () => {
  assert.match(surface, /const \[codeBusy, setCodeBusy\] = useState\(false\)/)
  assert.match(surface, /editingDisabled = saving \|\| closing \|\| imageBusy \|\| fileBusy \|\| codeBusy/)
  assert.match(surface, /Guardando código…/)
})
