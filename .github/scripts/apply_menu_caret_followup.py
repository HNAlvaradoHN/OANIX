from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Notes menu: choose up/down from actual available list space instead of note index.
replace_once(
    "src/features/notes/NotesWorkspace.tsx",
    "import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'",
    "import {\n  useEffect,\n  useMemo,\n  useRef,\n  useState,\n  type KeyboardEvent as ReactKeyboardEvent,\n  type MouseEvent as ReactMouseEvent,\n} from 'react'",
)

replace_once(
    "src/features/notes/NotesWorkspace.tsx",
    "  const [noteMenuId, setNoteMenuId] = useState<string | null>(null)\n",
    "  const [noteMenuId, setNoteMenuId] = useState<string | null>(null)\n  const [noteMenuDirection, setNoteMenuDirection] = useState<'down' | 'up'>('down')\n",
)

replace_once(
    "src/features/notes/NotesWorkspace.tsx",
    "  function handleTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {\n    if (event.key === 'Enter') {\n      event.currentTarget.blur()\n    }\n  }\n",
    "  function handleTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {\n    if (event.key === 'Enter') {\n      event.currentTarget.blur()\n    }\n  }\n\n  function toggleNoteMenu(noteId: string, event: ReactMouseEvent<HTMLButtonElement>) {\n    if (noteMenuId === noteId) {\n      setNoteMenuId(null)\n      return\n    }\n\n    const buttonRect = event.currentTarget.getBoundingClientRect()\n    const listRect = event.currentTarget.closest('.notes-list')?.getBoundingClientRect()\n    const topBoundary = listRect?.top ?? 0\n    const bottomBoundary = listRect?.bottom ?? window.innerHeight\n    const estimatedMenuHeight = 58\n    const spaceBelow = bottomBoundary - buttonRect.bottom\n    const spaceAbove = buttonRect.top - topBoundary\n\n    setNoteMenuDirection(\n      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'up' : 'down',\n    )\n    setNoteMenuId(noteId)\n  }\n",
)

replace_once(
    "src/features/notes/NotesWorkspace.tsx",
    "            notes.map((note, index) => (",
    "            notes.map((note) => (",
)

replace_once(
    "src/features/notes/NotesWorkspace.tsx",
    "                    onClick={() => setNoteMenuId((current) => current === note.id ? null : note.id)}",
    "                    onClick={(event) => toggleNoteMenu(note.id, event)}",
)

replace_once(
    "src/features/notes/NotesWorkspace.tsx",
    "                      className={`note-row__menu${index >= notes.length - 2 ? ' note-row__menu--up' : ''}`}",
    "                      className={`note-row__menu${noteMenuDirection === 'up' ? ' note-row__menu--up' : ''}`}",
)

# Editor terminal caret: keep a dedicated flow paragraph beside a floated image and
# a separate clear-both paragraph below the final image for reliable continuation.
replace_once(
    "src/features/images/ImageNoteEditor.tsx",
    "function ensureTrailingParagraph(editor: HTMLElement, after: HTMLElement): void {\n  const next = after.nextElementSibling\n\n  if (next instanceof HTMLParagraphElement) {\n    if ((next.textContent ?? '').trim() === '') {\n      next.dataset.oanixTrailingCaret = 'true'\n    } else {\n      delete next.dataset.oanixTrailingCaret\n    }\n  }\n\n  if (next) return\n\n  const paragraph = document.createElement('p')\n  paragraph.dataset.blockId = createBlockId()\n  paragraph.dataset.oanixTrailingCaret = 'true'\n  paragraph.append(document.createElement('br'))\n  editor.append(paragraph)\n}\n",
    "function createEmptyEditorParagraph(): HTMLParagraphElement {\n  const paragraph = document.createElement('p')\n  paragraph.dataset.blockId = createBlockId()\n  paragraph.append(document.createElement('br'))\n  return paragraph\n}\n\nfunction ensureTrailingParagraph(editor: HTMLElement): void {\n  const last = editor.lastElementChild\n\n  if (last instanceof HTMLParagraphElement && last.dataset.oanixTrailingCaret === 'true') {\n    return\n  }\n\n  if (last instanceof HTMLParagraphElement && (last.textContent ?? '').trim() === '') {\n    const previous = last.previousElementSibling\n    if (previous instanceof HTMLElement && previous.dataset.imageBlock === 'true') {\n      last.before(createEmptyEditorParagraph())\n    }\n\n    last.dataset.oanixTrailingCaret = 'true'\n    return\n  }\n\n  if (last instanceof HTMLElement && last.dataset.imageBlock === 'true') {\n    editor.append(createEmptyEditorParagraph())\n  }\n\n  const trailing = createEmptyEditorParagraph()\n  trailing.dataset.oanixTrailingCaret = 'true'\n  editor.append(trailing)\n}\n",
)

replace_once(
    "src/features/images/ImageNoteEditor.tsx",
    "      ensureTrailingParagraph(editor, element)",
    "      ensureTrailingParagraph(editor)",
)

replace_once(
    "src/features/images/ImageNoteEditor.tsx",
    "        ensureTrailingParagraph(editor, element)",
    "        ensureTrailingParagraph(editor)",
)

images_css = Path("src/features/images/images.css")
css_text = images_css.read_text(encoding="utf-8")
caret_css = """

/* Dedicated final writing zone below floated media. */
.image-note-editor-root .editor-surface > p[data-oanix-trailing-caret='true'] {
  display: block;
  clear: both;
  min-height: 2.75rem;
  margin: 0.4rem 0 0;
  padding: 0.35rem 0 0.15rem;
  cursor: text;
}
"""
if "data-oanix-trailing-caret='true'" not in css_text:
    images_css.write_text(css_text.rstrip() + caret_css + "\n", encoding="utf-8")

changelog = Path("docs/CHANGELOG.md")
change_text = changelog.read_text(encoding="utf-8")
anchor = "- Zona final de escritura reforzada después de imágenes para poder colocar el cursor debajo de la última imagen de forma fiable.\n"
addition = (
    anchor
    + "- Menú `⋮` con dirección adaptativa según el espacio disponible y zona terminal independiente debajo de imágenes flotantes, sin perder el flujo de texto lateral.\n"
)
if addition not in change_text:
    if anchor not in change_text:
        raise RuntimeError("CHANGELOG anchor not found")
    changelog.write_text(change_text.replace(anchor, addition, 1), encoding="utf-8")
