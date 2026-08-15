from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# 1) Make the final empty paragraph after an image a reliable writing target.
image_editor = 'src/features/images/ImageNoteEditor.tsx'
replace_once(
    image_editor,
    '''function ensureTrailingParagraph(editor: HTMLElement, after: HTMLElement): void {\n  const next = after.nextElementSibling\n  if (next) return\n\n  const paragraph = document.createElement('p')\n  paragraph.dataset.blockId = createBlockId()\n  paragraph.append(document.createElement('br'))\n  editor.append(paragraph)\n}\n''',
    '''function ensureTrailingParagraph(editor: HTMLElement, after: HTMLElement): void {\n  const next = after.nextElementSibling\n\n  if (next instanceof HTMLParagraphElement) {\n    if ((next.textContent ?? '').trim() === '') {\n      next.dataset.oanixTrailingCaret = 'true'\n    } else {\n      delete next.dataset.oanixTrailingCaret\n    }\n  }\n\n  if (next) return\n\n  const paragraph = document.createElement('p')\n  paragraph.dataset.blockId = createBlockId()\n  paragraph.dataset.oanixTrailingCaret = 'true'\n  paragraph.append(document.createElement('br'))\n  editor.append(paragraph)\n}\n''',
)
replace_once(
    image_editor,
    '''      if (!previewUrlsRef.current.has(block.imageId)) {\n        void hydrateImageElement(root, block, element)\n      }\n    }\n\n    if (imagesRef.current.size > 0) editor.dataset.empty = 'false'\n''',
    '''      if (!previewUrlsRef.current.has(block.imageId)) {\n        void hydrateImageElement(root, block, element)\n      }\n\n      ensureTrailingParagraph(editor, element)\n    }\n\n    if (imagesRef.current.size > 0) editor.dataset.empty = 'false'\n''',
)

# 2) Explicitly place the caret when clicking an empty paragraph, including the trailing image paragraph.
rich_editor = 'src/features/editor/RichTextEditor.tsx'
replace_once(
    rich_editor,
    '''      return\n    }\n\n    if (event.target === editor) {\n      hideLinkPopover()\n''',
    '''      return\n    }\n\n    const emptyParagraph = target?.closest('p') ?? null\n    if (isEmptyCaretParagraph(emptyParagraph) && editor.contains(emptyParagraph)) {\n      hideLinkPopover()\n\n      const selection = document.getSelection()\n      if (pointerDraggedRef.current || (selection && !selection.isCollapsed)) {\n        syncToolbarState()\n        return\n      }\n\n      event.preventDefault()\n      editor.focus()\n      placeCaretAtStart(emptyParagraph)\n      syncToolbarState()\n      return\n    }\n\n    if (event.target === editor) {\n      hideLinkPopover()\n''',
)

# 3) Give the trailing empty paragraph enough vertical hit area to feel natural on touch and desktop.
images_css = 'src/features/images/images.css'
replace_once(
    images_css,
    '''.image-note-editor__error {\n  margin: 0.75rem 0 0;\n  padding: 0.7rem 0.85rem;\n  border: 1px solid #fecaca;\n  border-radius: 10px;\n  background: #fff1f2;\n  color: #b42318;\n  font-size: 0.82rem;\n}\n''',
    '''.image-note-editor__error {\n  margin: 0.75rem 0 0;\n  padding: 0.7rem 0.85rem;\n  border: 1px solid #fecaca;\n  border-radius: 10px;\n  background: #fff1f2;\n  color: #b42318;\n  font-size: 0.82rem;\n}\n\n.image-note-editor-root .editor-surface > p[data-oanix-trailing-caret='true']:last-child {\n  min-height: 3.75rem;\n  margin-bottom: 0;\n  cursor: text;\n}\n''',
)

# 4) Move note deletion into a per-note actions menu.
workspace = 'src/features/notes/NotesWorkspace.tsx'
replace_once(
    workspace,
    '''import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'\n''',
    '''import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'\n''',
)
replace_once(
    workspace,
    '''  const [creating, setCreating] = useState(false)\n  const [deleting, setDeleting] = useState(false)\n  const [savingTitle, setSavingTitle] = useState(false)\n''',
    '''  const [creating, setCreating] = useState(false)\n  const [deletingId, setDeletingId] = useState<string | null>(null)\n  const [noteMenuId, setNoteMenuId] = useState<string | null>(null)\n  const [savingTitle, setSavingTitle] = useState(false)\n''',
)
replace_once(
    workspace,
    '''  const selectedNote = useMemo(\n    () => notes.find((note) => note.id === selectedId) ?? null,\n    [notes, selectedId],\n  )\n\n  useEffect(() => {\n''',
    '''  const selectedNote = useMemo(\n    () => notes.find((note) => note.id === selectedId) ?? null,\n    [notes, selectedId],\n  )\n  const deletingSelected = !!selectedNote && deletingId === selectedNote.id\n\n  useEffect(() => {\n''',
)
replace_once(
    workspace,
    '''  useEffect(() => {\n    return () => {\n      if (saveTimerRef.current !== null) {\n        window.clearTimeout(saveTimerRef.current)\n      }\n    }\n  }, [])\n\n  function replaceNoteInState(updated: NoteRecord) {\n''',
    '''  useEffect(() => {\n    return () => {\n      if (saveTimerRef.current !== null) {\n        window.clearTimeout(saveTimerRef.current)\n      }\n    }\n  }, [])\n\n  useEffect(() => {\n    function closeNoteMenu(event: PointerEvent) {\n      const target = event.target\n      if (target instanceof Element && target.closest('[data-note-menu-root="true"]')) return\n      setNoteMenuId(null)\n    }\n\n    function closeNoteMenuWithKeyboard(event: KeyboardEvent) {\n      if (event.key === 'Escape') setNoteMenuId(null)\n    }\n\n    document.addEventListener('pointerdown', closeNoteMenu)\n    document.addEventListener('keydown', closeNoteMenuWithKeyboard)\n\n    return () => {\n      document.removeEventListener('pointerdown', closeNoteMenu)\n      document.removeEventListener('keydown', closeNoteMenuWithKeyboard)\n    }\n  }, [])\n\n  function replaceNoteInState(updated: NoteRecord) {\n''',
)
replace_once(
    workspace,
    '''  async function handleDeleteNote() {\n    if (!selectedNote || deleting) return\n\n    const confirmed = window.confirm(\n      `¿Eliminar esta nota de forma permanente?\\n\\n“${selectedNote.title}” se eliminará de este dispositivo junto con sus imágenes asociadas. Esta acción no se puede deshacer.`,\n    )\n    if (!confirmed) return\n\n    const noteId = selectedNote.id\n    if (!(await flushPendingContent())) return\n    await finalizeRemovedImages()\n\n    setDeleting(true)\n    setError('')\n\n    try {\n      const deleted = await deleteNote(noteId)\n      const imageIds = deleted.content.blocks.flatMap((block) =>\n        block.type === 'image' ? [block.imageId] : [],\n      )\n\n      await Promise.allSettled(imageIds.map((imageId) => deleteEncryptedImage(imageId)))\n\n      const deletedIndex = notes.findIndex((note) => note.id === noteId)\n      const remaining = notes.filter((note) => note.id !== noteId)\n      const nextIndex = remaining.length === 0 ? -1 : Math.min(Math.max(deletedIndex, 0), remaining.length - 1)\n      const nextId = nextIndex >= 0 ? remaining[nextIndex].id : null\n\n      clearSaveTimer()\n      pendingContentRef.current = null\n      selectedIdRef.current = nextId\n      setNotes(remaining)\n      setSelectedId(nextId)\n      setSaveState('idle')\n      setError('')\n    } catch {\n      setSaveState('error')\n      setError('No se pudo eliminar la nota cifrada.')\n    } finally {\n      setDeleting(false)\n    }\n  }\n''',
    '''  async function handleDeleteNote(targetNote: NoteRecord) {\n    if (deletingId) return\n\n    const confirmed = window.confirm(\n      `¿Eliminar esta nota de forma permanente?\\n\\n“${targetNote.title}” se eliminará de este dispositivo junto con sus imágenes asociadas. Esta acción no se puede deshacer.`,\n    )\n    if (!confirmed) return\n\n    if (!(await flushPendingContent())) return\n    await finalizeRemovedImages()\n\n    const noteId = targetNote.id\n    const deletingSelectedNote = selectedIdRef.current === noteId\n    const deletedIndex = notes.findIndex((note) => note.id === noteId)\n    const remainingBeforeStateUpdate = notes.filter((note) => note.id !== noteId)\n    const nextIndex = remainingBeforeStateUpdate.length === 0\n      ? -1\n      : Math.min(Math.max(deletedIndex, 0), remainingBeforeStateUpdate.length - 1)\n    const nextId = nextIndex >= 0 ? remainingBeforeStateUpdate[nextIndex].id : null\n\n    setDeletingId(noteId)\n    setNoteMenuId(null)\n    setError('')\n\n    try {\n      const deleted = await deleteNote(noteId)\n      const imageIds = deleted.content.blocks.flatMap((block) =>\n        block.type === 'image' ? [block.imageId] : [],\n      )\n\n      await Promise.allSettled(imageIds.map((imageId) => deleteEncryptedImage(imageId)))\n\n      setNotes((current) => current.filter((note) => note.id !== noteId))\n\n      if (deletingSelectedNote) {\n        clearSaveTimer()\n        pendingContentRef.current = null\n        selectedIdRef.current = nextId\n        setSelectedId(nextId)\n        setSaveState('idle')\n      }\n\n      setError('')\n    } catch {\n      if (deletingSelectedNote) setSaveState('error')\n      setError('No se pudo eliminar la nota cifrada.')\n    } finally {\n      setDeletingId(null)\n    }\n  }\n''',
)
replace_once(
    workspace,
    '''  async function handleSelectNote(noteId: string) {\n    if (noteId === selectedId) return\n''',
    '''  async function handleSelectNote(noteId: string) {\n    setNoteMenuId(null)\n    if (noteId === selectedId) return\n''',
)
replace_once(
    workspace,
    '''  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {\n''',
    '''  function handleTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {\n''',
)
replace_once(
    workspace,
    '''            notes.map((note) => (\n              <button\n                className={`note-row${selectedId === note.id ? ' note-row--selected' : ''}`}\n                type="button"\n                key={note.id}\n                onClick={() => void handleSelectNote(note.id)}\n              >\n                <span className="note-row__avatar" aria-hidden="true">{noteInitial(note.title)}</span>\n                <span className="note-row__body">\n                  <span className="note-row__topline">\n                    <strong>{note.title}</strong>\n                    <time dateTime={note.updatedAt}>{formatNoteTime(note.updatedAt)}</time>\n                  </span>\n                  <span className="note-row__preview">{notePreview(note)}</span>\n                </span>\n              </button>\n            ))\n''',
    '''            notes.map((note, index) => (\n              <div\n                className={`note-row${selectedId === note.id ? ' note-row--selected' : ''}${noteMenuId === note.id ? ' note-row--menu-open' : ''}`}\n                key={note.id}\n                data-note-menu-root="true"\n              >\n                <button\n                  className="note-row__open"\n                  type="button"\n                  onClick={() => void handleSelectNote(note.id)}\n                >\n                  <span className="note-row__avatar" aria-hidden="true">{noteInitial(note.title)}</span>\n                  <span className="note-row__body">\n                    <span className="note-row__topline">\n                      <strong>{note.title}</strong>\n                      <time dateTime={note.updatedAt}>{formatNoteTime(note.updatedAt)}</time>\n                    </span>\n                    <span className="note-row__preview">{notePreview(note)}</span>\n                  </span>\n                </button>\n\n                <div className="note-row__menu-wrap">\n                  <button\n                    className="note-row__menu-button"\n                    type="button"\n                    aria-label={`Acciones de ${note.title}`}\n                    aria-haspopup="menu"\n                    aria-expanded={noteMenuId === note.id}\n                    title="Acciones de la nota"\n                    onClick={() => setNoteMenuId((current) => current === note.id ? null : note.id)}\n                  >\n                    ⋮\n                  </button>\n\n                  {noteMenuId === note.id && (\n                    <div\n                      className={`note-row__menu${index >= notes.length - 2 ? ' note-row__menu--up' : ''}`}\n                      role="menu"\n                      aria-label={`Acciones de ${note.title}`}\n                    >\n                      <button\n                        className="note-row__menu-danger"\n                        type="button"\n                        role="menuitem"\n                        disabled={deletingId !== null}\n                        onClick={() => void handleDeleteNote(note)}\n                      >\n                        {deletingId === note.id ? 'Eliminando…' : 'Eliminar nota'}\n                      </button>\n                    </div>\n                  )}\n                </div>\n              </div>\n            ))\n''',
)
replace_once(
    workspace,
    '''                    {deleting ? 'Eliminando nota…' : saveStateLabel(saveState, savingTitle)}\n''',
    '''                    {deletingSelected ? 'Eliminando nota…' : saveStateLabel(saveState, savingTitle)}\n''',
)
replace_once(
    workspace,
    '''              <button\n                className="delete-note-button"\n                type="button"\n                onClick={() => void handleDeleteNote()}\n                disabled={deleting}\n              >\n                {deleting ? 'Eliminando…' : 'Eliminar'}\n              </button>\n''',
    '''''',
)

# 5) Styling for the per-note menu; remove the header delete button styling.
notes_css = 'src/features/notes/notes.css'
replace_once(
    notes_css,
    '''.note-row {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: 0.78rem;\n  padding: 0.72rem 0.85rem;\n  border: 0;\n  background: transparent;\n  text-align: left;\n  color: inherit;\n}\n\n.note-row:hover { background: #f5f7f9; }\n.note-row--selected { background: #eaf2ff; }\n.note-row--selected:hover { background: #e5efff; }\n\n.note-row__avatar {\n  width: 3rem;\n  height: 3rem;\n  background: linear-gradient(145deg, #2563eb, #4f46e5);\n  font-size: 1rem;\n}\n\n.note-row__body {\n  min-width: 0;\n  flex: 1;\n  display: grid;\n  gap: 0.25rem;\n}\n\n.note-row__topline {\n  min-width: 0;\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 0.7rem;\n}\n\n.note-row__topline strong {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 0.96rem;\n}\n\n.note-row__topline time {\n  flex: 0 0 auto;\n  color: #8a94a2;\n  font-size: 0.73rem;\n}\n\n.note-row__preview {\n  overflow: hidden;\n  color: #7a8593;\n  font-size: 0.84rem;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n''',
    '''.note-row {\n  position: relative;\n  width: 100%;\n  display: flex;\n  align-items: stretch;\n  border: 0;\n  background: transparent;\n  color: inherit;\n}\n\n.note-row:hover { background: #f5f7f9; }\n.note-row--selected { background: #eaf2ff; }\n.note-row--selected:hover,\n.note-row--menu-open { background: #e5efff; }\n\n.note-row__open {\n  min-width: 0;\n  flex: 1;\n  display: flex;\n  align-items: center;\n  gap: 0.78rem;\n  padding: 0.72rem 0.35rem 0.72rem 0.85rem;\n  border: 0;\n  outline: none;\n  background: transparent;\n  text-align: left;\n  color: inherit;\n}\n\n.note-row__open:focus-visible {\n  box-shadow: inset 3px 0 0 #2563eb;\n}\n\n.note-row__avatar {\n  width: 3rem;\n  height: 3rem;\n  background: linear-gradient(145deg, #2563eb, #4f46e5);\n  font-size: 1rem;\n}\n\n.note-row__body {\n  min-width: 0;\n  flex: 1;\n  display: grid;\n  gap: 0.25rem;\n}\n\n.note-row__topline {\n  min-width: 0;\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 0.7rem;\n}\n\n.note-row__topline strong {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 0.96rem;\n}\n\n.note-row__topline time {\n  flex: 0 0 auto;\n  color: #8a94a2;\n  font-size: 0.73rem;\n}\n\n.note-row__preview {\n  overflow: hidden;\n  color: #7a8593;\n  font-size: 0.84rem;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.note-row__menu-wrap {\n  position: relative;\n  flex: 0 0 auto;\n  display: grid;\n  place-items: center;\n  padding-right: 0.55rem;\n}\n\n.note-row__menu-button {\n  width: 2.35rem;\n  height: 2.35rem;\n  display: grid;\n  place-items: center;\n  padding: 0;\n  border: 0;\n  border-radius: 50%;\n  background: #eef2f6;\n  color: #596575;\n  font-size: 1.35rem;\n  line-height: 1;\n}\n\n.note-row__menu-button:hover,\n.note-row__menu-button:focus-visible,\n.note-row__menu-button[aria-expanded='true'] {\n  outline: none;\n  background: #dbeafe;\n  color: #1d4ed8;\n}\n\n.note-row__menu {\n  position: absolute;\n  z-index: 30;\n  top: calc(100% - 0.15rem);\n  right: 0;\n  min-width: 170px;\n  padding: 0.35rem;\n  border: 1px solid #d9e0e7;\n  border-radius: 12px;\n  background: #fff;\n  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);\n}\n\n.note-row__menu--up {\n  top: auto;\n  bottom: calc(100% - 0.15rem);\n}\n\n.note-row__menu button {\n  width: 100%;\n  min-height: 2.45rem;\n  padding: 0 0.75rem;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  text-align: left;\n  font: inherit;\n  font-size: 0.84rem;\n  font-weight: 750;\n}\n\n.note-row__menu-danger { color: #b42318; }\n\n.note-row__menu-danger:hover:not(:disabled),\n.note-row__menu-danger:focus-visible {\n  outline: none;\n  background: #fff1f2;\n}\n\n.note-row__menu button:disabled {\n  cursor: wait;\n  opacity: 0.55;\n}\n''',
)
replace_once(
    notes_css,
    '''.delete-note-button {\n  flex: 0 0 auto;\n  margin-left: auto;\n  min-height: 2.35rem;\n  padding: 0 0.8rem;\n  border: 1px solid #fecaca;\n  border-radius: 999px;\n  background: #fff;\n  color: #b91c1c;\n  font-weight: 750;\n}\n\n.delete-note-button:hover:not(:disabled) {\n  border-color: #fca5a5;\n  background: #fef2f2;\n}\n\n.delete-note-button:disabled {\n  cursor: wait;\n  opacity: 0.6;\n}\n\n''',
    '''''',
)
replace_once(
    notes_css,
    '''  .note-view__header { padding-top: max(0.85rem, env(safe-area-inset-top)); }\n  .delete-note-button { padding: 0 0.7rem; }\n  .note-canvas { width: min(100% - 1.5rem, 880px); }\n''',
    '''  .note-view__header { padding-top: max(0.85rem, env(safe-area-inset-top)); }\n  .note-row__menu-button { width: 2.45rem; height: 2.45rem; }\n  .note-canvas { width: min(100% - 1.5rem, 880px); }\n''',
)

# 6) Persist the deferred per-note avatar/photo idea so it is not lost.
roadmap = 'docs/ROADMAP.md'
replace_once(
    roadmap,
    '''- [ ] Temas y personalización avanzada\n- [ ] IA opcional con modelo de privacidad definido\n''',
    '''- [ ] Temas y personalización avanzada\n- [ ] Avatar o foto opcional por nota, almacenada de forma privada\n- [ ] IA opcional con modelo de privacidad definido\n''',
)

# 7) Changelog for the V1 UX fixes.
changelog = 'docs/CHANGELOG.md'
replace_once(
    changelog,
    '''- Vista previa de texto real de cada nota en la lista principal.\n''',
    '''- Vista previa de texto real de cada nota en la lista principal.\n- Menú contextual `⋮` por nota en la lista, con eliminación permanente movida fuera de la cabecera de edición.\n- Zona final de escritura reforzada después de imágenes para poder colocar el cursor debajo de la última imagen de forma fiable.\n''',
)
