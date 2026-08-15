from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if marker in text:
        return
    file.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


image_editor = 'src/features/images/ImageNoteEditor.tsx'
replace_once(
    image_editor,
    "import { loadEncryptedImage, loadEncryptedImagePreview, storeEncryptedImage } from './imageService'\n",
    "import { loadEncryptedImage, loadEncryptedImagePreview, storeEncryptedImage } from './imageService'\nimport { clampImageWidthPercent, defaultImageWidthPercent, isMobileImageViewport } from './imageLayout'\n",
)
replace_once(
    image_editor,
    "const DEFAULT_IMAGE_WIDTH = 100\nconst MIN_IMAGE_WIDTH_PERCENT = 35\nconst MIN_IMAGE_WIDTH_PIXELS = 220\nconst COMPACT_IMAGE_PERCENT = 55\n",
    "const DEFAULT_IMAGE_WIDTH = 100\nconst COMPACT_IMAGE_PERCENT = 55\n",
)
replace_once(
    image_editor,
    "function clampImageWidth(editorWidth: number, widthPercent: number): number {\n  const pixelMinimum = editorWidth > 0 ? (MIN_IMAGE_WIDTH_PIXELS / editorWidth) * 100 : 100\n  const minimum = Math.min(100, Math.max(MIN_IMAGE_WIDTH_PERCENT, Math.ceil(pixelMinimum)))\n  return Math.min(100, Math.max(minimum, Math.round(widthPercent)))\n}\n",
    "function usesMobileImageLayout(): boolean {\n  const viewportWidth = window.visualViewport?.width ?? window.innerWidth\n  return isMobileImageViewport(viewportWidth)\n}\n\nfunction clampImageWidth(editorWidth: number, widthPercent: number): number {\n  return clampImageWidthPercent(editorWidth, widthPercent, usesMobileImageLayout())\n}\n",
)
replace_once(
    image_editor,
    "          widthPercent: DEFAULT_IMAGE_WIDTH,\n",
    "          widthPercent: defaultImageWidthPercent(usesMobileImageLayout()),\n",
)
replace_once(
    image_editor,
    "  const [imageError, setImageError] = useState('')\n\n  function mergedBlocks(editorBlocks: NoteBlock[]): StoredNoteBlock[] {\n",
    "  const [imageError, setImageError] = useState('')\n  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)\n\n  function mergedBlocks(editorBlocks: NoteBlock[]): StoredNoteBlock[] {\n",
)
replace_once(
    image_editor,
    "  function updateHistoryButtons(root: HTMLElement | null = rootRef.current) {\n    const undo = root?.querySelector<HTMLButtonElement>('[data-undo-tool=\"true\"]')\n    const redo = root?.querySelector<HTMLButtonElement>('[data-redo-tool=\"true\"]')\n    if (undo) undo.disabled = undoHistoryRef.current.length === 0\n    if (redo) redo.disabled = redoHistoryRef.current.length === 0\n  }\n",
    "  function updateHistoryButtons(root: HTMLElement | null = rootRef.current) {\n    root?.querySelectorAll<HTMLButtonElement>('[data-undo-tool=\"true\"]').forEach((undo) => {\n      undo.disabled = undoHistoryRef.current.length === 0\n    })\n    root?.querySelectorAll<HTMLButtonElement>('[data-redo-tool=\"true\"]').forEach((redo) => {\n      redo.disabled = redoHistoryRef.current.length === 0\n    })\n  }\n",
)
replace_once(
    image_editor,
    "      if (event.key === 'Escape') {\n        setPreview(null)\n        setPreviewZoom(1)\n      }\n",
    "      if (event.key === 'Escape') {\n        setPreview(null)\n        setPreviewZoom(1)\n        setMobileToolsOpen(false)\n      }\n",
)
replace_once(
    image_editor,
    "  return (\n    <div ref={rootRef} className=\"image-note-editor-root\">\n      <CodeBlockEditor\n",
    "  return (\n    <div\n      ref={rootRef}\n      className={`image-note-editor-root${mobileToolsOpen ? ' image-note-editor-root--mobile-tools-open' : ''}`}\n    >\n      <CodeBlockEditor\n",
)
replace_once(
    image_editor,
    "        onBlur={onBlur}\n      />\n\n      <input\n",
    "        onBlur={onBlur}\n      />\n\n      <div className=\"mobile-editor-dock\" role=\"toolbar\" aria-label=\"Acciones rápidas del editor\">\n        <button\n          className=\"mobile-editor-dock__history\"\n          type=\"button\"\n          data-undo-tool=\"true\"\n          aria-label=\"Deshacer último cambio\"\n          title=\"Deshacer\"\n        >\n          ↶\n        </button>\n        <button\n          className=\"mobile-editor-dock__history\"\n          type=\"button\"\n          data-redo-tool=\"true\"\n          aria-label=\"Rehacer último cambio\"\n          title=\"Rehacer\"\n        >\n          ↷\n        </button>\n        <button\n          className=\"mobile-editor-dock__tools\"\n          type=\"button\"\n          data-mobile-tools-toggle=\"true\"\n          aria-label={mobileToolsOpen ? 'Cerrar herramientas de edición' : 'Abrir herramientas de edición'}\n          aria-expanded={mobileToolsOpen}\n          title=\"Herramientas de edición\"\n          onClick={() => setMobileToolsOpen((open) => !open)}\n        >\n          ☷\n        </button>\n      </div>\n\n      <input\n",
)

# Mobile floating format panel and safe long labels.
append_once(
    'src/features/editor/editor.css',
    '/* OANIX mobile floating editor tools */',
    r'''/* OANIX mobile floating editor tools */
@media (max-width: 760px) {
  .editor-frame {
    grid-template-rows: minmax(calc(100dvh - 300px), auto);
  }

  .editor-toolbar {
    display: none;
  }

  .image-note-editor-root--mobile-tools-open .editor-toolbar {
    position: fixed;
    z-index: 1320;
    right: 0.75rem;
    bottom: calc(4.65rem + env(safe-area-inset-bottom));
    left: 0.75rem;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
    max-height: min(52dvh, 28rem);
    padding: 0.65rem;
    overflow-x: hidden;
    overflow-y: auto;
    border: 1px solid #d8e0ea;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.24);
  }

  .image-note-editor-root--mobile-tools-open .editor-toolbar .editor-tool {
    width: 100%;
    min-width: 0;
    min-height: 2.7rem;
    height: auto;
    padding: 0.48rem 0.35rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .image-note-editor-root--mobile-tools-open .editor-toolbar__separator,
  .image-note-editor-root--mobile-tools-open .editor-toolbar [data-undo-tool='true'],
  .image-note-editor-root--mobile-tools-open .editor-toolbar [data-redo-tool='true'] {
    display: none;
  }

  .editor-surface {
    min-height: calc(100dvh - 300px);
    padding-bottom: 6.25rem;
  }

  .editor-link-popover__actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .editor-link-popover__actions button {
    min-width: 0;
    padding: 0.45rem 0.35rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
    white-space: normal;
  }
}

@media (max-width: 360px) {
  .image-note-editor-root--mobile-tools-open .editor-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}''',
)

# Mobile image sizing and compact information popover.
append_once(
    'src/features/images/images.css',
    '/* OANIX mobile image sizing and floating editor dock */',
    r'''/* OANIX mobile image sizing and floating editor dock */
.mobile-editor-dock {
  display: none;
}

@media (max-width: 760px) {
  .image-note-editor-root .editor-image-block {
    min-width: min(88px, 100%);
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'] .editor-image-block__preview,
  .image-note-editor-root .editor-image-block[data-image-compact='true'] .editor-image-block__preview img {
    min-height: 0;
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'] .editor-image-block__footer {
    gap: 0.3rem;
    padding: 0.3rem;
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'] .editor-image-block__actions {
    flex-wrap: nowrap;
    justify-content: center;
    gap: 0.2rem;
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'] .editor-image-block__lock,
  .image-note-editor-root .editor-image-block[data-image-compact='true'] .editor-image-block__info {
    width: 2.2rem;
    min-width: 2.2rem;
    min-height: 2.2rem;
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'] .editor-image-block__open {
    display: none;
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__footer {
    position: absolute;
    z-index: 12;
    top: calc(100% + 0.4rem);
    width: min(18rem, calc(100vw - 1.5rem));
    padding: 0.6rem;
    border: 1px solid #d8e0ea;
    border-radius: 12px;
    box-shadow: 0 16px 38px rgba(15, 23, 42, 0.22);
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'][data-image-alignment='left'] .editor-image-block__footer {
    left: 0;
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'][data-image-alignment='right'] .editor-image-block__footer {
    right: 0;
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'][data-image-alignment='center'] .editor-image-block__footer {
    left: 50%;
    transform: translateX(-50%);
  }

  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__open {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .image-note-editor-root .editor-image-block__actions button,
  .image-note-editor-root .editor-image-block__details,
  .image-note-editor-root .editor-image-block__meta {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .image-note-editor-root .editor-image-block__actions button {
    height: auto;
    padding-block: 0.4rem;
    line-height: 1.15;
    white-space: normal;
  }

  .mobile-editor-dock {
    position: fixed;
    z-index: 1330;
    right: max(0.75rem, env(safe-area-inset-right));
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    gap: 0.32rem;
    padding: 0.32rem;
    border: 1px solid rgba(203, 213, 225, 0.9);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 12px 34px rgba(15, 23, 42, 0.22);
    backdrop-filter: blur(14px);
  }

  .mobile-editor-dock button {
    width: 2.65rem;
    height: 2.65rem;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #475569;
    font: inherit;
    font-size: 1.15rem;
    font-weight: 800;
  }

  .mobile-editor-dock button:disabled {
    opacity: 0.32;
  }

  .mobile-editor-dock__tools {
    background: #2563eb !important;
    color: #fff !important;
    font-size: 1.25rem !important;
  }

  .mobile-editor-dock__tools[aria-expanded='true'] {
    background: #1d4ed8 !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
  }
}
''',
)

# Code toolbar becomes a readable grid instead of squeezing long labels.
append_once(
    'src/features/editor/codeBlockEditor.css',
    '/* OANIX mobile code toolbar readability */',
    r'''/* OANIX mobile code toolbar readability */
@media (max-width: 640px) {
  .code-block-editor-root .editor-code-block__toolbar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 0.4rem;
    padding: 0.55rem;
  }

  .code-block-editor-root .editor-code-block__language {
    grid-column: 1 / -1;
    width: 100%;
    max-width: none;
    min-height: 2.45rem;
  }

  .code-block-editor-root .editor-code-block__convert,
  .code-block-editor-root .editor-code-block__delete,
  .code-block-editor-root .editor-code-block__copy {
    width: 100%;
    min-width: 0;
    min-height: 2.5rem;
    margin: 0;
    padding: 0.48rem 0.4rem;
    line-height: 1.15;
    text-align: center;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .code-block-editor-root .editor-code-block__copy {
    grid-column: 1 / -1;
  }

  .code-delete-dialog__panel,
  .code-delete-dialog__panel h3,
  .code-delete-dialog__panel p,
  .code-delete-dialog__actions button {
    min-width: 0;
    overflow-wrap: anywhere;
  }
}''',
)

# General note controls should never spill out on narrow phones.
append_once(
    'src/features/notes/notes.css',
    '/* OANIX responsive control text safety */',
    r'''/* OANIX responsive control text safety */
.note-row__menu button,
.new-note-button,
.empty-action,
.notes-error,
.note-editor-placeholder {
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .note-row__menu button,
  .empty-action {
    white-space: normal;
  }
}''',
)

# Record the implementation. Roadmap checkboxes stay pending until browser validation.
changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
marker = '- Menú `⋮` con dirección adaptativa según el espacio disponible y zona terminal independiente debajo de imágenes flotantes, sin perder el flujo de texto lateral.\n'
addition = marker + '- Pulido móvil del editor preparado: imágenes con rango de tamaño más pequeño, herramientas flotantes, Deshacer/Rehacer persistentes y controles largos reorganizados para evitar recortes.\n'
if marker not in text:
    raise SystemExit('Expected changelog marker not found')
changelog.write_text(text.replace(marker, addition, 1), encoding='utf-8')
