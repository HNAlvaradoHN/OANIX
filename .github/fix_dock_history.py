from pathlib import Path

p = Path('src/features/images/ImageNoteEditor.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("  function handleDockUndo() {\n    const root = rootRef.current\n    if (root) undoLastChange(root)\n  }\n\n  function handleDockRedo() {\n    const root = rootRef.current\n    if (root) redoLastChange(root)\n  }\n\n", "", 1)
text = text.replace("          title=\"Deshacer\"\n          onClick={handleDockUndo}\n", "          title=\"Deshacer\"\n", 1)
text = text.replace("          title=\"Rehacer\"\n          onClick={handleDockRedo}\n", "          title=\"Rehacer\"\n", 1)
p.write_text(text, encoding='utf-8')
