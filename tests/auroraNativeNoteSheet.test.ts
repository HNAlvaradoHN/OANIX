import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspace = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
const sheet = readFileSync('src/features/notes/themes/aurora-native/AuroraNativeNoteSheet.tsx', 'utf8')
const blocks = readFileSync('src/features/notes/themes/aurora-native/AuroraNativeBlocks.tsx', 'utf8')
const css = readFileSync('src/features/notes/themes/aurora-native/auroraNativeNoteSheet.css', 'utf8')
const contract = readFileSync('src/features/notes/noteSheetThemeContract.ts', 'utf8')
const operations = readFileSync('src/features/notes/nativeNoteSheetOperations.ts', 'utf8')
const types = readFileSync('src/features/notes/noteTypes.ts', 'utf8')
const notesCss = readFileSync('src/features/notes/notes.css', 'utf8')
const model = readFileSync('src/features/notes/themes/aurora-native/auroraNativeModel.ts', 'utf8')

test('open-note UI is the isolated native Aurora sheet, not the legacy editor presentation', () => {
  assert.match(workspace, /<AuroraNativeNoteSheet/)
  assert.doesNotMatch(workspace, /<ImageNoteEditor/)
  assert.match(sheet, /attachShadow\(\{ mode: 'open' \}\)/)
  assert.match(sheet, /auroraNativeNoteSheet\.css\?inline/)
  assert.match(sheet, /createPortal\(/)
})

test('Aurora notebook backgrounds stay attached to each real text block', () => {
  assert.match(css, /\.block-body\{line-height:var\(--rule\);font-family:var\(--f-body\)\}/)
  assert.match(css, /\.page\.bg-renglones \.block-body\{background-image:repeating-linear-gradient/)
  assert.match(css, /transparent calc\(var\(--rule\) - 1px\)/)
  assert.match(css, /\.page\.bg-puntos \.block-body\{background-image:radial-gradient/)
  assert.match(css, /background-size:34px var\(--rule\)/)
  assert.match(css, /\.page\.bg-cuadricula \.block-body\{background-image:linear-gradient/)
})

test('Aurora contextual menus use the prototype geometry', () => {
  assert.match(sheet, /top: Math\.round\(anchor\.bottom \+ 8\)/)
  assert.match(sheet, /anchor\.right - 210/)
  assert.match(sheet, /window\.innerWidth - 218/)
  assert.match(sheet, /fixedNear\(anchor, 280, 420\)/)
  assert.match(css, /\.imgbar\{position:fixed;z-index:55;display:flex/)
  assert.match(css, /max-width:94vw;overflow-x:auto/)
})

test('native Aurora preserves prototype insertion and long-paste behavior', () => {
  assert.match(sheet, /type InsertMode = 'after' \| 'replace' \| 'caret'/)
  assert.match(sheet, /element\.innerText\.trim\(\) === '' \? 'replace' : 'caret'/)
  assert.match(sheet, /text\.split\('\\n'\)\.length > 50/)
  assert.match(sheet, /language: 'plaintext'/)
  assert.match(sheet, /Texto largo → código \(Texto plano\)/)
  assert.match(sheet, /clipboard\.files/)
  assert.match(sheet, /onStoreImage\(file\)/)
})

test('native Aurora uses exact code and Daily Entry editable structures', () => {
  assert.match(blocks, /as="code"/)
  assert.match(blocks, /className="entry-title"/)
  assert.match(blocks, /className="entry-body"/)
  assert.match(blocks, /html=\{runsToHtml\(body\.runs\)\}/)
  assert.match(blocks, /maxLines=\{2\}/)
  assert.match(blocks, /maxLines=\{3\}/)
})

test('inserted block deletion is guarded before the real mutation', () => {
  assert.match(sheet, /window\.confirm\(\`¿Eliminar este \$\{label\.toLocaleLowerCase\(\)\} de la nota\?\`\)/)
  assert.match(sheet, /window\.confirm\(\`¿Quitar “\$\{attachment\.name\}” de esta nota\?\`\)/)
  assert.match(workspace, /handleDeleteNote\(targetNote, true\)/)
})

test('native Aurora contract binds encrypted OANIX image and attachment services', () => {
  assert.match(contract, /onLoadImage:/)
  assert.match(contract, /onStoreImage:/)
  assert.match(contract, /onLoadAttachments:/)
  assert.match(contract, /onStoreAttachments:/)
  assert.match(operations, /loadEncryptedImage/)
  assert.match(operations, /storeEncryptedImage/)
  assert.match(operations, /loadEncryptedAttachments/)
  assert.match(operations, /storeEncryptedAttachment/)
  assert.match(operations, /removeEncryptedAttachment/)
  assert.match(operations, /exportRemoteLargeAttachment/)
})

test('Aurora-only presentation state round-trips in the encrypted note record', () => {
  assert.match(types, /sheetAppearance\?: NoteSheetAppearance/)
  assert.match(types, /avatarEmoji\?: string/)
  assert.match(types, /showDate\?: boolean/)
  assert.match(types, /showLineNumbers\?: boolean/)
  assert.match(types, /wrapLines\?: boolean/)
  assert.match(types, /type: 'file'/)
  assert.match(types, /attachmentIds: string\[\]/)
})

test('native title and selection respect the ShadowRoot editing host', () => {
  assert.match(sheet, /rootNode instanceof ShadowRoot \? rootNode\.activeElement : document\.activeElement/)
  assert.match(sheet, /function selectionForRoot\(root: HTMLElement\)/)
  assert.match(sheet, /getSelection\?: \(\) => Selection \| null/)
})


test('outer workspace canvas cannot bleed through the isolated native sheet', () => {
  assert.match(workspace, /note-view note-view--aurora-native/)
  assert.match(notesCss, /\.note-view\.note-view--aurora-native/)
  assert.match(notesCss, /background: transparent !important/)
  assert.match(notesCss, /\.aurora-native-note-sheet-host/)
  assert.match(notesCss, /min-height: 100dvh/)
})


test('Aurora mobile review regressions keep safe areas, compact controls and stable continuation flow', () => {
  assert.match(css, /env\(safe-area-inset-top,0px\)/)
  assert.match(css, /\.fab-action/)
  assert.match(css, /\.fab-sep/)
  assert.match(css, /\.insert-menu\{[\s\S]*bottom:max\(78px/)
  assert.match(sheet, /if \(insertState\) \{[\s\S]*setInsertState\(null\)/)
  assert.match(sheet, /oanix:sync-status/)
  assert.match(sheet, /Guardando cambios antes de sincronizar…/)
  assert.match(css, /\.note-body-divider/)
  assert.match(css, /@media \(hover:none\) and \(pointer:coarse\)/)
  assert.match(css, /\.grain\{display:none\}/)
  assert.match(sheet, /imageActionsOpen, blocksVersion/)
  assert.match(sheet, /window\.visualViewport/)
  assert.match(model, /const following = source\[index \+ 1\]/)
  assert.match(model, /if \(!isNativeTextBlock\(following\)\)/)
  assert.match(model, /withBodies\.push\(emptyParagraph\(\)\)/)
})

test('encrypted image lifecycle follows native structural undo redo instead of stale delete queues', () => {
  assert.match(sheet, /function reconcileQueuedImageRemovals\(from: StoredNoteBlock\[], to: StoredNoteBlock\[]\)/)
  assert.match(sheet, /if \(!after\.has\(imageId\)\) propsRef\.current\.onQueueImageRemoval\(imageId\)/)
  assert.match(sheet, /if \(!before\.has\(imageId\)\) propsRef\.current\.onRestoreQueuedImage\(imageId\)/)
  assert.match(sheet, /reconcileQueuedImageRemovals\(blocksRef\.current, previous\)/)
  assert.match(sheet, /reconcileQueuedImageRemovals\(blocksRef\.current, next\)/)
})
