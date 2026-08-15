from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# Repository: expose encrypted note deletion.
repo = 'src/storage/repositories/noteRepository.ts'
replace_once(
    repo,
    '''import {\n  listEncryptedRecords,\n  readEncryptedRecord,\n  writeEncryptedRecord,\n} from './encryptedRecordRepository'\n''',
    '''import {\n  deleteEncryptedRecord,\n  listEncryptedRecords,\n  readEncryptedRecord,\n  writeEncryptedRecord,\n} from './encryptedRecordRepository'\n''',
)
replace_once(
    repo,
    '''export async function readNote(noteId: string): Promise<NoteRecord | null> {\n''',
    '''export async function deleteNoteRecord(noteId: string): Promise<void> {\n  await deleteEncryptedRecord(NOTE_RECORD_TYPE, noteId)\n}\n\nexport async function readNote(noteId: string): Promise<NoteRecord | null> {\n''',
)

# Service: serialize deletion behind any in-flight mutations and return the final note snapshot.
service = 'src/features/notes/noteService.ts'
replace_once(
    service,
    '''import { listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'\n''',
    '''import { deleteNoteRecord, listNotes, readNote, saveNote } from '../../storage/repositories/noteRepository'\n''',
)
replace_once(
    service,
    '''export function renameNote(noteId: string, title: string): Promise<NoteRecord> {\n''',
    '''export function deleteNote(noteId: string): Promise<NoteRecord> {\n  const previous = mutationQueues.get(noteId) ?? Promise.resolve()\n  const next = previous\n    .catch(() => undefined)\n    .then(async () => {\n      const existing = await readNote(noteId)\n\n      if (!existing) {\n        throw new Error('La nota ya no existe.')\n      }\n\n      await deleteNoteRecord(noteId)\n      return existing\n    })\n\n  mutationQueues.set(noteId, next)\n  const cleanup = () => {\n    if (mutationQueues.get(noteId) === next) {\n      mutationQueues.delete(noteId)\n    }\n  }\n  void next.then(cleanup, cleanup)\n\n  return next\n}\n\nexport function renameNote(noteId: string, title: string): Promise<NoteRecord> {\n''',
)

# Workspace: confirmation, cleanup of encrypted images, next-note selection, UI state.
workspace = 'src/features/notes/NotesWorkspace.tsx'
replace_once(
    workspace,
    '''import { createEmptyNote, loadNotes, renameNote, replaceNoteContent } from './noteService'\n''',
    '''import { createEmptyNote, deleteNote, loadNotes, renameNote, replaceNoteContent } from './noteService'\n''',
)
replace_once(
    workspace,
    '''  const [creating, setCreating] = useState(false)\n  const [savingTitle, setSavingTitle] = useState(false)\n''',
    '''  const [creating, setCreating] = useState(false)\n  const [deleting, setDeleting] = useState(false)\n  const [savingTitle, setSavingTitle] = useState(false)\n''',
)
replace_once(
    workspace,
    '''  async function handleCreateNote() {\n''',
    '''  async function handleDeleteNote() {\n    if (!selectedNote || deleting) return\n\n    const confirmed = window.confirm(\n      `¿Eliminar esta nota de forma permanente?\\n\\n“${selectedNote.title}” se eliminará de este dispositivo junto con sus imágenes asociadas. Esta acción no se puede deshacer.`,\n    )\n    if (!confirmed) return\n\n    const noteId = selectedNote.id\n    if (!(await flushPendingContent())) return\n    await finalizeRemovedImages()\n\n    setDeleting(true)\n    setError('')\n\n    try {\n      const deleted = await deleteNote(noteId)\n      const imageIds = deleted.content.blocks.flatMap((block) =>\n        block.type === 'image' ? [block.imageId] : [],\n      )\n\n      await Promise.allSettled(imageIds.map((imageId) => deleteEncryptedImage(imageId)))\n\n      const deletedIndex = notes.findIndex((note) => note.id === noteId)\n      const remaining = notes.filter((note) => note.id !== noteId)\n      const nextIndex = remaining.length === 0 ? -1 : Math.min(Math.max(deletedIndex, 0), remaining.length - 1)\n      const nextId = nextIndex >= 0 ? remaining[nextIndex].id : null\n\n      clearSaveTimer()\n      pendingContentRef.current = null\n      selectedIdRef.current = nextId\n      setNotes(remaining)\n      setSelectedId(nextId)\n      setSaveState('idle')\n      setError('')\n    } catch {\n      setSaveState('error')\n      setError('No se pudo eliminar la nota cifrada.')\n    } finally {\n      setDeleting(false)\n    }\n  }\n\n  async function handleCreateNote() {\n''',
)
replace_once(
    workspace,
    '''              <div className="note-view__identity">\n                <span className="note-view__avatar" aria-hidden="true">{noteInitial(selectedNote.title)}</span>\n                <div>\n                  <strong>{selectedNote.title}</strong>\n                  <span className={saveState === 'error' ? 'save-status save-status--error' : 'save-status'}>\n                    {saveStateLabel(saveState, savingTitle)}\n                  </span>\n                </div>\n              </div>\n            </header>\n''',
    '''              <div className="note-view__identity">\n                <span className="note-view__avatar" aria-hidden="true">{noteInitial(selectedNote.title)}</span>\n                <div>\n                  <strong>{selectedNote.title}</strong>\n                  <span className={saveState === 'error' ? 'save-status save-status--error' : 'save-status'}>\n                    {deleting ? 'Eliminando nota…' : saveStateLabel(saveState, savingTitle)}\n                  </span>\n                </div>\n              </div>\n              <button\n                className="delete-note-button"\n                type="button"\n                onClick={() => void handleDeleteNote()}\n                disabled={deleting}\n              >\n                {deleting ? 'Eliminando…' : 'Eliminar'}\n              </button>\n            </header>\n''',
)

# Styling for the explicit destructive action.
css = 'src/features/notes/notes.css'
replace_once(
    css,
    '''.back-button:hover { background: #f1f4f7; }\n\n.note-canvas {\n''',
    '''.back-button:hover { background: #f1f4f7; }\n\n.delete-note-button {\n  flex: 0 0 auto;\n  margin-left: auto;\n  min-height: 2.35rem;\n  padding: 0 0.8rem;\n  border: 1px solid #fecaca;\n  border-radius: 999px;\n  background: #fff;\n  color: #b91c1c;\n  font-weight: 750;\n}\n\n.delete-note-button:hover:not(:disabled) {\n  border-color: #fca5a5;\n  background: #fef2f2;\n}\n\n.delete-note-button:disabled {\n  cursor: wait;\n  opacity: 0.6;\n}\n\n.note-canvas {\n''',
)
replace_once(
    css,
    '''  .note-view__header { padding-top: max(0.85rem, env(safe-area-inset-top)); }\n''',
    '''  .note-view__header { padding-top: max(0.85rem, env(safe-area-inset-top)); }\n  .delete-note-button { padding: 0 0.7rem; }\n''',
)

# Changelog.
changelog = 'docs/CHANGELOG.md'
replace_once(
    changelog,
    '''- Notas cifradas locales con creación, listado, selección y cambio de título.\n''',
    '''- Notas cifradas locales con creación, listado, selección, cambio de título y eliminación permanente confirmada con limpieza de imágenes asociadas.\n''',
)
