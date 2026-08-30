import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const theme = readFileSync('src/features/notes/themes/aurora/AuroraNoteSheet.tsx', 'utf8')
const css = readFileSync('src/features/notes/themes/aurora/auroraNoteSheet.css', 'utf8')
const contract = readFileSync('src/features/notes/noteSheetThemeContract.ts', 'utf8')
const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const imageEditor = readFileSync('src/features/images/ImageNoteEditor.tsx', 'utf8')
const attachments = readFileSync('src/features/attachments/NoteAttachmentsRuntime.tsx', 'utf8')
const pasteRuntime = readFileSync('src/features/editor/LargePasteRuntime.tsx', 'utf8')

test('Aurora note sheet is an isolated swappable theme fed by real OANIX values', () => {
  assert.match(contract, /export interface NoteSheetThemeProps/)
  assert.match(contract, /note: NoteRecord/)
  assert.match(contract, /editor: ReactNode/)
  assert.match(workspace, /<AuroraNoteSheet/)
  assert.match(workspace, /note=\{selectedNote\}/)
  assert.match(workspace, /folders=\{folders\}/)
  assert.match(workspace, /tags=\{tags\}/)
  assert.match(workspace, /editor=\{\(/)
  assert.match(theme, /data-note-sheet-theme="aurora"/)
  assert.match(theme, /Personalizar hoja/)
  assert.match(theme, /Añadir bloque/)
  assert.match(theme, /Entrada diaria/)
  assert.match(theme, /Archivos/)
  assert.match(theme, /Checklist/)
  assert.match(theme, /Contacto/)
})

test('Aurora controls delegate to real editor and attachment runtimes', () => {
  assert.match(theme, /oanix:note-sheet-command/)
  assert.match(theme, /oanix:note-sheet-attachment-request/)
  assert.match(imageEditor, /window\.addEventListener\('oanix:note-sheet-command'/)
  assert.match(imageEditor, /'insert-dailyEntry': '\[data-insert="dailyEntry"\]'/)
  assert.match(imageEditor, /'insert-code': '\[data-format="code"\]'/)
  assert.match(imageEditor, /'insert-checklist': '\[data-insert="checklist"\]'/)
  assert.match(imageEditor, /'insert-contact': '\[data-insert="contact"\]'/)
  assert.match(attachments, /oanix:note-sheet-attachment-request/)
})

test('theme keeps the prototype visual vocabulary without external runtime CDN dependencies', () => {
  assert.match(css, /--aurora-paper:#F6F3EC/)
  assert.match(css, /--aurora-acc:#D9542B/)
  assert.match(css, /aurora-code-bg:#20242E/)
  assert.match(css, /aurora-fab/)
  assert.match(css, /aurora-drawer/)
  assert.match(css, /aurora-bubble/)
  assert.doesNotMatch(theme, /cdn\.jsdelivr|unpkg\.com|lucide@/)
})

test('destructive element actions remain confirmation-gated', () => {
  assert.match(imageEditor, /window\.confirm/)
  assert.match(imageEditor, /¿Quitar/)
  assert.match(workspace, /confirmationAlreadyShown/)
  assert.match(theme, /Eliminar nota/)
})

test('the superseded 50-line automatic conversion no longer exists', () => {
  assert.doesNotMatch(pasteRuntime, /shouldEncapsulateClipboardPaste/)
  assert.doesNotMatch(pasteRuntime, /LARGE_PASTE_LINE_THRESHOLD/)
  assert.doesNotMatch(pasteRuntime, /codeTool\.click\(\)/)
  assert.match(pasteRuntime, /Ordinary clipboard paste is intentionally left to the browser/)
})
