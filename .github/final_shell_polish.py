from pathlib import Path

notes = Path('src/features/notes/notes.css')
text = notes.read_text(encoding='utf-8')
text = text.replace('@media (max-width: 720px) {', '@media (max-width: 760px) {', 1)
text = text.replace('@media (min-width: 721px) {', '@media (min-width: 761px) {', 1)
if '.save-status--error' not in text:
    text += "\n.save-status--error { color: #b42318 !important; font-weight: 800; }\n"
notes.write_text(text, encoding='utf-8')

images = Path('src/features/images/ImageNoteEditor.tsx')
text = images.read_text(encoding='utf-8')
needle = "      const target = event.target\n      if (!(target instanceof Element)) return\n\n      const undoTool = target.closest<HTMLElement>('[data-undo-tool=\"true\"]')\n"
replacement = "      const target = event.target\n      if (!(target instanceof Element)) return\n\n      if (!target.closest('.editor-command-panel') && !target.closest('.mobile-editor-dock')) {\n        setActiveDockPanel(null)\n      }\n\n      const undoTool = target.closest<HTMLElement>('[data-undo-tool=\"true\"]')\n"
if needle not in text:
    raise SystemExit('Expected editor click marker not found')
images.write_text(text.replace(needle, replacement, 1), encoding='utf-8')
