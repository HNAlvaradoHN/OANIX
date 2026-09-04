import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const surface = readFileSync('src/features/editor/implementations/OanixNotesSheetSurface.tsx', 'utf8')
const card = readFileSync('src/features/editor/implementations/OanixFileGroupCard.tsx', 'utf8')
const wrapper = readFileSync('src/features/editor/implementations/OanixMixedDocumentWithFiles.tsx', 'utf8')

test('Archivos in the editor menu creates a new independent file-group selection', () => {
  assert.match(surface, /if \(tool === 'file'\) openFilePicker\(\)/)
  assert.match(surface, /ref=\{fileInputRef\}[\s\S]*type="file"[\s\S]*multiple/)
  assert.match(surface, /insertOanixFileGroup\(/)
  assert.match(surface, /pendingFileGroupBlockIdRef/)
})

test('existing file card can append files and remove individual files or the whole card', () => {
  assert.match(card, /Añadir archivos/)
  assert.match(card, /Eliminar tarjeta/)
  assert.match(card, /Quitar archivo/)
  assert.match(card, /openAttachment/)
  assert.match(surface, /appendOanixFileGroupFiles\(/)
  assert.match(surface, /removeFileFromGroup/)
  assert.match(surface, /removeFileGroup/)
})

test('file card floating menu chooses up or down from available viewport space', () => {
  assert.match(card, /spaceBelow < 230 && spaceAbove > spaceBelow \? 'up' : 'down'/)
  assert.match(card, /data-direction=\{menuDirection\}/)
})

test('file groups are composed without modifying the validated image renderer', () => {
  assert.match(wrapper, /OanixMixedDocumentBody/)
  assert.match(wrapper, /OanixFileGroupCard/)
  assert.match(wrapper, /decodeOanixFileGroupElement/)
  assert.match(surface, /OanixMixedDocumentWithFiles/)
})
