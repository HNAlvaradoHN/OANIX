from pathlib import Path

path = Path('src/features/editor/RichTextEditor.tsx')
text = path.read_text(encoding='utf-8')
old = """  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {\n    const target = event.target\n    if (!(target instanceof Element)) return\n\n    const dailyTitle = target.closest<HTMLInputElement>('[data-daily-entry-title=\"true\"]')\n"""
new = """  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {\n    const editor = editorRef.current\n    const target = event.target\n    if (!editor || !(target instanceof Element)) return\n\n    const dailyTitle = target.closest<HTMLInputElement>('[data-daily-entry-title=\"true\"]')\n"""
if old not in text:
    raise SystemExit('Expected daily entry keydown marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
