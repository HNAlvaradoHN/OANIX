import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('note metadata supports independent Home and folder order plus soft card customization', () => {
  const model = readFileSync('src/features/rebuild/rebuildModel.ts', 'utf8')
  const service = readFileSync('src/features/rebuild/rebuildService.ts', 'utf8')

  assert.match(model, /order\?: number/)
  assert.match(model, /folderOrder\?: NoteV2FolderOrder/)
  assert.match(model, /export function noteHomeOrder\(note: NoteV2Meta\)/)
  assert.match(model, /export function noteFolderOrder\(note: NoteV2Meta\)/)
  assert.match(model, /note\.folderOrder\?\.folderId === note\.folderId/)
  assert.match(model, /cardColor\?: string \| null/)
  assert.match(model, /cardIcon\?: string \| null/)
  assert.match(service, /export async function saveRebuildNoteCard/)
  assert.match(service, /export async function saveRebuildNoteOrder/)
  assert.match(service, /export async function saveRebuildNoteFolderOrder/)
  assert.match(service, /persistNoteMetaUpdate\(existing, \{ folderOrder: \{ folderId, order \} \}\)/)
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

test('Home and each folder expose their own guarded drag order while tags, search and recents do not', () => {
  const app = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
  const list = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')
  const listCss = readFileSync('src/features/rebuild/noteListSection.css', 'utf8')

  assert.match(app, /<NoteListSection/)
  assert.match(app, /orderMode=\{/)
  assert.match(app, /viewMode === 'home'/)
  assert.match(app, /activeTagId === null/)
  assert.match(app, /query\.trim\(\)\.length === 0/)
  assert.match(app, /activeFolderId === null \? 'home' : 'folder'/)
  assert.doesNotMatch(app, /canReorder=/)
  assert.match(app, /onMove=\{\(note, previous, next\)/)
  assert.match(list, /type NoteOrderMode = 'home' \| 'folder' \| null/)
  assert.match(list, /mode === 'folder' \? noteFolderOrder\(note\) : noteHomeOrder\(note\)/)
  assert.match(list, /rebuild-note-row__drag/)
  assert.match(list, /const DRAG_HOLD_MS = 200/)
  assert.match(list, /const DRAG_MOVE_THRESHOLD_PX = 6/)
  assert.match(list, /window\.setTimeout/)
  assert.match(list, /candidate\.armed/)
  assert.match(list, /Math\.hypot/)
  assert.match(list, /onPointerDown=/)
  assert.match(list, /onPointerUp=/)
  assert.match(list, /onPointerCancel=/)
  assert.match(list, /onContextMenu=/)
  assert.match(listCss, /touch-action: none !important/)
  assert.doesNotMatch(list, /aria-label=\{`Subir/)
  assert.doesNotMatch(list, /aria-label=\{`Bajar/)
  assert.match(list, /onCustomize\(note\)/)
})

test('normal note surfaces keep native vertical scrolling while only the drag handle blocks panning', () => {
  const listCss = readFileSync('src/features/rebuild/noteListSection.css', 'utf8')

  assert.match(
    listCss,
    /\.rebuild-notes,\s*\.rebuild-note-list,\s*\.rebuild-note-row,\s*\.rebuild-note-row__open\s*\{\s*touch-action: pan-y;/,
  )
  assert.match(listCss, /\.rebuild-notes\s*\{\s*-webkit-overflow-scrolling: touch;/)
  assert.match(listCss, /\.rebuild-note-row__drag\s*\{[\s\S]*?touch-action: none !important;/)
})

test('active drag dims the other rows and visually lifts the moved note', () => {
  const list = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')
  const listCss = readFileSync('src/features/rebuild/noteListSection.css', 'utf8')

  assert.match(list, /rebuild-note-list\$\{draggingId \? ' is-reordering' : ''\}/)
  assert.match(list, /is-drag-pressing/)
  assert.match(list, /is-drag-ready/)
  assert.match(list, /is-dragging/)
  assert.match(listCss, /\.rebuild-note-list\.is-reordering \.rebuild-note-row:not\(\.is-dragging\)/)
  assert.match(listCss, /opacity: \.58/)
  assert.match(listCss, /transform: scale\(1\.018\)/)
  assert.match(listCss, /box-shadow:/)
  assert.match(listCss, /prefers-reduced-motion: reduce/)
})

test('dragging near the note viewport edges auto-scrolls the real notes container', () => {
  const list = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')

  assert.match(list, /const AUTO_SCROLL_EDGE_PX = 82/)
  assert.match(list, /const AUTO_SCROLL_MAX_PX = 18/)
  assert.match(list, /closest<HTMLElement>\('\.rebuild-notes'\)/)
  assert.match(list, /container\.scrollTop \+= delta/)
  assert.match(list, /window\.requestAnimationFrame\(runAutoScroll\)/)
  assert.match(list, /reorderAtPoint\(noteId, pointer\.x, pointer\.y\)/)
})

test('dropping persists only the moved note in the active Home or folder order scope', () => {
  const app = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')

  assert.match(app, /function noteOrderForScope/)
  assert.match(app, /function orderForMovedNote/)
  assert.match(app, /previousOrder \+ \(nextOrder - previousOrder\) \/ 2/)
  assert.match(app, /const scope: NoteOrderScope = folderId \? 'folder' : 'home'/)
  assert.match(app, /folderOrder: \{ folderId, order: nextOrder \}/)
  assert.match(app, /await saveRebuildNoteFolderOrder\(note, folderId, nextOrder\)/)
  assert.match(app, /await saveRebuildNoteOrder\(note, nextOrder\)/)
  assert.match(app, /item\.id === note\.id \? optimistic : item/)
  assert.doesNotMatch(app, /async function swapNotes/)
})

test('new notes receive both Home order and the active folder order without affecting other folders', () => {
  const app = readFileSync('src/features/rebuild/RebuildApp.tsx', 'utf8')
  const service = readFileSync('src/features/rebuild/rebuildService.ts', 'utf8')

  assert.match(app, /notes\.filter\(\(note\) => note\.folderId === folderId\)/)
  assert.match(app, /folderNotes\.map\(\(note\) => noteFolderOrder\(note\)\)/)
  assert.match(app, /createRebuildNote\(folderId, nextOrder, nextFolderOrder\)/)
  assert.match(service, /folderOrder\?: number/)
  assert.match(service, /folderOrder: \{/)
  assert.match(service, /folderId,/)
})
