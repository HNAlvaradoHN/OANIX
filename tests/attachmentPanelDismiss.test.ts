import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const attachmentsRuntime = readFileSync('src/features/attachments/NoteAttachmentsRuntime.tsx', 'utf8')
const imageEditor = readFileSync('src/features/images/ImageNoteEditor.tsx', 'utf8')

test('adjuntar archivo cierra Insertar antes de abrir el selector', () => {
  const closeCall = attachmentsRuntime.indexOf('closeEditorCommandPanel()')
  const pickerCall = attachmentsRuntime.indexOf('inputRef.current?.click()', closeCall)

  assert.ok(closeCall >= 0)
  assert.ok(pickerCall > closeCall)
  assert.match(
    attachmentsRuntime,
    /new KeyboardEvent\('keydown', \{ key: 'Escape', bubbles: true \}\)/,
  )
})

test('Escape sigue cerrando el panel del editor compartido', () => {
  assert.match(imageEditor, /if \(event\.key === 'Escape'\) \{[\s\S]*setActiveDockPanel\(null\)/)
})
