from pathlib import Path

path = Path('src/features/editor/RichTextEditor.tsx')
text = path.read_text(encoding='utf-8')

text = text.replace(
"""  type KeyboardEvent as ReactKeyboardEvent,\n  type MouseEvent,\n} from 'react'\n""",
"""  type KeyboardEvent as ReactKeyboardEvent,\n  type MouseEvent,\n  type PointerEvent as ReactPointerEvent,\n} from 'react'\n""",
1,
)

text = text.replace(
"""  const lastHtmlRef = useRef(initialHtmlRef.current)\n  const restoringRef = useRef(false)\n""",
"""  const lastHtmlRef = useRef(initialHtmlRef.current)\n  const restoringRef = useRef(false)\n  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)\n  const pointerDraggedRef = useRef(false)\n""",
1,
)

text = text.replace(
"""  async function handleEditorClick(event: MouseEvent<HTMLDivElement>) {\n""",
"""  function handleEditorPointerDown(event: ReactPointerEvent<HTMLDivElement>) {\n    if (event.button != 0) return\n    pointerStartRef.current = { x: event.clientX, y: event.clientY }\n    pointerDraggedRef.current = false\n  }\n\n  function handleEditorPointerMove(event: ReactPointerEvent<HTMLDivElement>) {\n    const start = pointerStartRef.current\n    if (!start || (event.buttons & 1) === 0) return\n\n    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)\n    if (distance > 4) pointerDraggedRef.current = true\n  }\n\n  function handleEditorPointerUp() {\n    window.setTimeout(() => {\n      pointerStartRef.current = null\n      pointerDraggedRef.current = false\n    }, 0)\n  }\n\n  async function handleEditorClick(event: MouseEvent<HTMLDivElement>) {\n""",
1,
)

text = text.replace(
"""    if (event.target === editor) {\n      hideLinkPopover()\n      event.preventDefault()\n      const insertedParagraph = placeCaretFromEditorBackground(editor, event.clientY)\n      if (insertedParagraph) emitChange()\n      syncToolbarState()\n      return\n    }\n""",
"""    if (event.target === editor) {\n      hideLinkPopover()\n\n      const selection = document.getSelection()\n      if (pointerDraggedRef.current || (selection && !selection.isCollapsed)) {\n        syncToolbarState()\n        return\n      }\n\n      event.preventDefault()\n      const insertedParagraph = placeCaretFromEditorBackground(editor, event.clientY)\n      if (insertedParagraph) emitChange()\n      syncToolbarState()\n      return\n    }\n""",
1,
)

text = text.replace(
"""        onClick={handleEditorClick}\n        onInput={emitChange}\n""",
"""        onPointerDown={handleEditorPointerDown}\n        onPointerMove={handleEditorPointerMove}\n        onPointerUp={handleEditorPointerUp}\n        onClick={handleEditorClick}\n        onInput={emitChange}\n""",
1,
)

path.write_text(text, encoding='utf-8')

changelog = Path('docs/CHANGELOG.md')
c = changelog.read_text(encoding='utf-8')
marker = '- Selección visual neutral para bloques protegidos y posicionamiento del cursor en espacios vacíos entre, al lado o después de imagen/código.\n'
addition = marker + '- Protección del cursor frente a arrastres de selección: un gesto de selección ya no puede activar el reposicionamiento de clic en espacio vacío.\n'
if marker not in c:
    raise SystemExit('changelog marker missing')
changelog.write_text(c.replace(marker, addition, 1), encoding='utf-8')
