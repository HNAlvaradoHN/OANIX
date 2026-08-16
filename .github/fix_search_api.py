from pathlib import Path

path = Path('src/features/notes/NotesWorkspace.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace(
    "import { filterNotesByLocalSearch } from '../search/localSearch'",
    "import { filterByLocalSearch } from '../search/localSearch'",
    1,
)
text = text.replace(
    "return filterNotesByLocalSearch(organized, searchQuery)",
    "return filterByLocalSearch(organized, searchQuery, (note) => `${note.title}\\n${noteBlocksToPlainText(note.content.blocks)}`)",
    1,
)
path.write_text(text, encoding='utf-8')
