from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected marker not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if marker in text:
        return
    p.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


# ---------------------------------------------------------------------------
# Note model: backwards-compatible encrypted tag relationships.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/noteTypes.ts',
    """  updatedAt: string
  folderId?: string | null
  content: {
""",
    """  updatedAt: string
  folderId?: string | null
  tagIds?: string[]
  content: {
""",
)

replace_once(
    'src/features/notes/noteTypes.ts',
    """    typeof note.updatedAt === 'string' &&
    (note.folderId === undefined || note.folderId === null || typeof note.folderId === 'string') &&
    !!note.content &&
""",
    """    typeof note.updatedAt === 'string' &&
    (note.folderId === undefined || note.folderId === null || typeof note.folderId === 'string') &&
    (note.tagIds === undefined ||
      (Array.isArray(note.tagIds) &&
        note.tagIds.every((tagId) => typeof tagId === 'string' && tagId.length > 0) &&
        new Set(note.tagIds).size === note.tagIds.length)) &&
    !!note.content &&
""",
)

# ---------------------------------------------------------------------------
# Note service: initialize and mutate tag relationships through the same queue.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/noteService.ts',
    "export async function createEmptyNote(folderId: string | null = null): Promise<NoteRecord> {\n",
    "export async function createEmptyNote(folderId: string | null = null, tagIds: string[] = []): Promise<NoteRecord> {\n",
)

replace_once(
    'src/features/notes/noteService.ts',
    """    updatedAt: now,
    folderId,
    content: {
""",
    """    updatedAt: now,
    folderId,
    tagIds: [...new Set(tagIds.filter((tagId) => tagId.length > 0))],
    content: {
""",
)

append_once(
    'src/features/notes/noteService.ts',
    'export function setNoteTags(',
    r'''
export function setNoteTags(noteId: string, tagIds: string[]): Promise<NoteRecord> {
  const normalizedTagIds = [...new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean))]
  return enqueueNoteMutation(noteId, (existing) => ({
    ...existing,
    tagIds: normalizedTagIds,
    updatedAt: new Date().toISOString(),
  }))
}
''',
)

# ---------------------------------------------------------------------------
# Workspace imports and state.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """import type { FolderRecord } from '../folders/folderTypes'
import { storageSaveErrorMessage } from '../../storage/local/storageErrors'
""",
    """import type { FolderRecord } from '../folders/folderTypes'
import { createTag, deleteTag, loadTags, renameTag } from '../tags/tagService'
import type { TagRecord } from '../tags/tagTypes'
import { storageSaveErrorMessage } from '../../storage/local/storageErrors'
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    "import { createEmptyNote, deleteNote, loadNotes, moveNoteToFolder, renameNote, replaceNoteContent } from './noteService'\n",
    "import { createEmptyNote, deleteNote, loadNotes, moveNoteToFolder, renameNote, replaceNoteContent, setNoteTags } from './noteService'\n",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all')
""",
    """  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all')
  const [activeTagId, setActiveTagId] = useState<string | 'all'>('all')
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const [folderScrollEdges, setFolderScrollEdges] = useState({ left: false, right: false })
  const [selectedId, setSelectedId] = useState<string | null>(null)
""",
    """  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const [folderScrollEdges, setFolderScrollEdges] = useState({ left: false, right: false })
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [tagBusyId, setTagBusyId] = useState<string | null>(null)
  const [creatingTag, setCreatingTag] = useState(false)
  const [tagEditorNoteId, setTagEditorNoteId] = useState<string | null>(null)
  const [tagDraftIds, setTagDraftIds] = useState<string[]>([])
  const [savingNoteTags, setSavingNoteTags] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """  const deletingSelected = !!selectedNote && deletingId === selectedNote.id
  const visibleNotes = useMemo(
    () => activeFolderId === 'all'
      ? notes
      : notes.filter((note) => note.folderId === activeFolderId),
    [notes, activeFolderId],
  )
  const moveTargetNote = useMemo(
""",
    """  const deletingSelected = !!selectedNote && deletingId === selectedNote.id
  const activeTag = useMemo(
    () => activeTagId === 'all' ? null : tags.find((tag) => tag.id === activeTagId) ?? null,
    [tags, activeTagId],
  )
  const visibleNotes = useMemo(
    () => notes.filter((note) =>
      (activeFolderId === 'all' || note.folderId === activeFolderId) &&
      (activeTagId === 'all' || (note.tagIds ?? []).includes(activeTagId)),
    ),
    [notes, activeFolderId, activeTagId],
  )
  const moveTargetNote = useMemo(
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """  const moveTargetNote = useMemo(
    () => notes.find((note) => note.id === moveNoteId) ?? null,
    [notes, moveNoteId],
  )

  useEffect(() => {
""",
    """  const moveTargetNote = useMemo(
    () => notes.find((note) => note.id === moveNoteId) ?? null,
    [notes, moveNoteId],
  )
  const tagEditorNote = useMemo(
    () => notes.find((note) => note.id === tagEditorNoteId) ?? null,
    [notes, tagEditorNoteId],
  )

  useEffect(() => {
""",
)

# ---------------------------------------------------------------------------
# Load tags together with notes/folders and close tag dialogs with Escape.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """    void Promise.all([loadNotes(), loadFolders()])
      .then(([storedNotes, storedFolders]) => {
        if (!active) return
        setNotes(storedNotes)
        setFolders(storedFolders)
      })
      .catch(() => {
        if (!active) return
        setError('No se pudieron cargar las notas y carpetas cifradas de este dispositivo.')
""",
    """    void Promise.all([loadNotes(), loadFolders(), loadTags()])
      .then(([storedNotes, storedFolders, storedTags]) => {
        if (!active) return
        setNotes(storedNotes)
        setFolders(storedFolders)
        setTags(storedTags)
      })
      .catch(() => {
        if (!active) return
        setError('No se pudieron cargar las notas, carpetas y etiquetas cifradas de este dispositivo.')
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """        setMoveNoteId(null)
        setFolderManagerOpen(false)
      }
""",
    """        setMoveNoteId(null)
        setFolderManagerOpen(false)
        setTagFilterOpen(false)
        setTagManagerOpen(false)
        setTagEditorNoteId(null)
      }
""",
)

# ---------------------------------------------------------------------------
# Tag helpers and filter switching.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """  function folderName(folderId: string | null | undefined): string {
    if (!folderId) return 'Sin carpeta'
    return folders.find((folder) => folder.id === folderId)?.name ?? 'Carpeta no disponible'
  }

  function clearSaveTimer() {
""",
    """  function folderName(folderId: string | null | undefined): string {
    if (!folderId) return 'Sin carpeta'
    return folders.find((folder) => folder.id === folderId)?.name ?? 'Carpeta no disponible'
  }

  function tagRecordsFor(note: NoteRecord): TagRecord[] {
    const ids = new Set(note.tagIds ?? [])
    return tags.filter((tag) => ids.has(tag.id))
  }

  function sortTagState(nextTags: TagRecord[]): TagRecord[] {
    return [...nextTags].sort((left, right) =>
      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
    )
  }

  function clearSaveTimer() {
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """  async function handleCreateNote() {
""",
    """  async function handleSelectTag(tagId: string | 'all') {
    if (tagId === activeTagId) {
      setTagFilterOpen(false)
      return
    }
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    setActiveTagId(tagId)
    selectedIdRef.current = null
    setSelectedId(null)
    setSaveState('idle')
    setNoteMenuId(null)
    setActiveNoteMenuOpen(false)
    setNoteInfoOpen(false)
    setTagFilterOpen(false)

    if (mobileSinglePane()) {
      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')
    }
  }

  async function handleCreateNote() {
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """      const note = await createEmptyNote(activeFolderId === 'all' ? null : activeFolderId)
      setNotes((current) => [note, ...current])
""",
    """      const note = await createEmptyNote(
        activeFolderId === 'all' ? null : activeFolderId,
        activeTagId === 'all' ? [] : [activeTagId],
      )
      setNotes((current) => [note, ...current])
""",
)

# ---------------------------------------------------------------------------
# Tag CRUD + note assignment.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """  async function persistTitle() {
""",
    r'''  function tagNameExists(name: string, exceptId?: string): boolean {
    const candidate = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    return tags.some((tag) =>
      tag.id !== exceptId && tag.name.toLocaleLowerCase() === candidate,
    )
  }

  async function handleCreateTag() {
    const name = newTagName.trim().replace(/\s+/g, ' ')
    if (!name) {
      setError('Escribe un nombre para la etiqueta.')
      return
    }
    if (tagNameExists(name)) {
      setError('Ya existe una etiqueta con ese nombre.')
      return
    }

    setCreatingTag(true)
    setError('')
    try {
      const tag = await createTag(name)
      setTags((current) => sortTagState([...current, tag]))
      setNewTagName('')
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : 'No se pudo crear la etiqueta cifrada.')
    } finally {
      setCreatingTag(false)
    }
  }

  function beginTagRename(tag: TagRecord) {
    setEditingTagId(tag.id)
    setEditingTagName(tag.name)
    setError('')
  }

  async function handleRenameTag(tag: TagRecord) {
    const name = editingTagName.trim().replace(/\s+/g, ' ')
    if (!name) {
      setError('El nombre de la etiqueta no puede estar vacío.')
      return
    }
    if (tagNameExists(name, tag.id)) {
      setError('Ya existe una etiqueta con ese nombre.')
      return
    }

    setTagBusyId(tag.id)
    setError('')
    try {
      const updated = await renameTag(tag.id, name)
      setTags((current) => sortTagState(
        current.map((item) => item.id === updated.id ? updated : item),
      ))
      setEditingTagId(null)
      setEditingTagName('')
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : 'No se pudo renombrar la etiqueta.')
    } finally {
      setTagBusyId(null)
    }
  }

  function openTagEditor(note: NoteRecord) {
    setTagDraftIds(note.tagIds ?? [])
    setTagEditorNoteId(note.id)
    setNoteMenuId(null)
    setActiveNoteMenuOpen(false)
    setError('')
  }

  function toggleTagDraft(tagId: string) {
    setTagDraftIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    )
  }

  async function handleSaveNoteTags() {
    if (!tagEditorNote || savingNoteTags) return
    if (tagEditorNote.id === selectedIdRef.current && !(await flushPendingContent())) return

    setSavingNoteTags(true)
    setError('')
    try {
      const validIds = tagDraftIds.filter((tagId) => tags.some((tag) => tag.id === tagId))
      const updated = await setNoteTags(tagEditorNote.id, validIds)
      replaceNoteInState(updated)
      if (updated.id === selectedIdRef.current) setSaveState('saved')
      setTagEditorNoteId(null)
    } catch {
      setError('No se pudieron guardar las etiquetas de la nota.')
    } finally {
      setSavingNoteTags(false)
    }
  }

  async function handleDeleteTag(tag: TagRecord) {
    const affected = notes.filter((note) => (note.tagIds ?? []).includes(tag.id))
    const detail = affected.length === 0
      ? 'La etiqueta se eliminará. No está asignada a ninguna nota.'
      : `La etiqueta se quitará de ${affected.length} nota${affected.length === 1 ? '' : 's'}.`
    if (!window.confirm(`¿Eliminar la etiqueta “${tag.name}”?\n\n${detail}\n\nLas notas NO se eliminarán.`)) return

    if (!(await flushPendingContent())) return
    setTagBusyId(tag.id)
    setError('')
    try {
      const updatedNotes = await Promise.all(
        affected.map((note) => setNoteTags(note.id, (note.tagIds ?? []).filter((id) => id !== tag.id))),
      )
      if (updatedNotes.length > 0) {
        const updatedById = new Map(updatedNotes.map((note) => [note.id, note]))
        setNotes((current) => current.map((note) => updatedById.get(note.id) ?? note))
      }
      await deleteTag(tag.id)
      setTags((current) => current.filter((item) => item.id !== tag.id))
      setTagDraftIds((current) => current.filter((id) => id !== tag.id))
      if (activeTagId === tag.id) {
        setActiveTagId('all')
        selectedIdRef.current = null
        setSelectedId(null)
        setSaveState('idle')
      }
      if (editingTagId === tag.id) {
        setEditingTagId(null)
        setEditingTagName('')
      }
    } catch {
      setError('No se pudo completar la eliminación de la etiqueta.')
    } finally {
      setTagBusyId(null)
    }
  }

  async function persistTitle() {
''',
)

# Menus are taller with the new action.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '    const estimatedMenuHeight = 108\n',
    '    const estimatedMenuHeight = 150\n',
)

# ---------------------------------------------------------------------------
# Workspace menu: tag manager.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setWorkspaceMenuOpen(false)
                      window.alert('OANIX V1 · bóveda local cifrada · offline-first')
                    }}
""",
    """                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setWorkspaceMenuOpen(false)
                      setTagManagerOpen(true)
                    }}
                  >
                    <span aria-hidden="true">🏷</span> Administrar etiquetas
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setWorkspaceMenuOpen(false)
                      window.alert('OANIX V1 · bóveda local cifrada · offline-first')
                    }}
""",
)

# ---------------------------------------------------------------------------
# Compact tag filter below folders.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """        </div>

        {error && <p className="notes-error" role="alert">{error}</p>}
""",
    """        </div>

        <div className="notes-tag-filter">
          <button
            className={`tag-filter-button${activeTag ? ' tag-filter-button--active' : ''}`}
            type="button"
            onClick={() => tags.length === 0 ? setTagManagerOpen(true) : setTagFilterOpen(true)}
            aria-label="Filtrar notas por etiqueta"
            title="Filtrar por etiqueta"
          >
            <span aria-hidden="true">🏷</span>
            <span>{activeTag?.name ?? 'Todas las etiquetas'}</span>
            <span aria-hidden="true">⌄</span>
          </button>
          <button
            className="tag-manage-button"
            type="button"
            onClick={() => setTagManagerOpen(true)}
            aria-label="Administrar etiquetas"
            title="Administrar etiquetas"
          >
            ＋
          </button>
        </div>

        {error && <p className="notes-error" role="alert">{error}</p>}
""",
)

# Empty state respects tag filter.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """          ) : visibleNotes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty__icon" aria-hidden="true">📁</div>
              <strong>Esta carpeta está vacía</strong>
              <p>Las notas que crees aquí quedarán organizadas en esta carpeta cifrada.</p>
              <button className="empty-action" type="button" onClick={() => void handleCreateNote()} disabled={creating}>
                Crear nota aquí
              </button>
            </div>
""",
    """          ) : visibleNotes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty__icon" aria-hidden="true">{activeTag ? '🏷' : '📁'}</div>
              <strong>{activeTag ? 'No hay notas con esta etiqueta' : 'Esta carpeta está vacía'}</strong>
              <p>
                {activeTag
                  ? `Las notas nuevas creadas con este filtro recibirán “${activeTag.name}”.`
                  : 'Las notas que crees aquí quedarán organizadas en esta carpeta cifrada.'}
              </p>
              <button className="empty-action" type="button" onClick={() => void handleCreateNote()} disabled={creating}>
                Crear nota aquí
              </button>
            </div>
""",
)

# List note menu: assign tags.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setNoteMenuId(null)
                          setMoveNoteId(note.id)
                        }}
                      >
                        Mover a carpeta
                      </button>
""",
    """                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openTagEditor(note)}
                      >
                        Etiquetas
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setNoteMenuId(null)
                          setMoveNoteId(note.id)
                        }}
                      >
                        Mover a carpeta
                      </button>
""",
)

# Active note menu: assign tags.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """                  <div className="note-view__menu" role="menu" aria-label="Acciones de la nota">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveNoteMenuOpen(false)
                        setMoveNoteId(selectedNote.id)
                      }}
                    >
                      <span aria-hidden="true">📁</span> Mover a carpeta
                    </button>
""",
    """                  <div className="note-view__menu" role="menu" aria-label="Acciones de la nota">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openTagEditor(selectedNote)}
                    >
                      <span aria-hidden="true">🏷</span> Etiquetas
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveNoteMenuOpen(false)
                        setMoveNoteId(selectedNote.id)
                      }}
                    >
                      <span aria-hidden="true">📁</span> Mover a carpeta
                    </button>
""",
)

# Tag chips under note title.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """              </label>

              {saveState === 'error' && error && (
""",
    """              </label>

              <div className="note-tag-strip" aria-label="Etiquetas de la nota">
                {tagRecordsFor(selectedNote).map((tag) => (
                  <span className="note-tag-chip" key={tag.id}>#{tag.name}</span>
                ))}
                <button type="button" className="note-tag-add" onClick={() => openTagEditor(selectedNote)}>
                  ＋ Etiqueta
                </button>
              </div>

              {saveState === 'error' && error && (
""",
)

# Info dialog includes tags.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """                <div><dt>Carpeta</dt><dd>{folderName(selectedNote.folderId)}</dd></div>
                <div><dt>Bloques</dt><dd>{selectedNote.content.blocks.length}</dd></div>
""",
    """                <div><dt>Carpeta</dt><dd>{folderName(selectedNote.folderId)}</dd></div>
                <div><dt>Etiquetas</dt><dd>{tagRecordsFor(selectedNote).map((tag) => tag.name).join(', ') || 'Sin etiquetas'}</dd></div>
                <div><dt>Bloques</dt><dd>{selectedNote.content.blocks.length}</dd></div>
""",
)

# ---------------------------------------------------------------------------
# Dialogs: filter, manage, assign.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """      {moveTargetNote && (
""",
    r'''      {tagFilterOpen && (
        <div className="folder-dialog" role="presentation" onClick={() => setTagFilterOpen(false)}>
          <div className="folder-dialog__panel folder-dialog__panel--move" role="dialog" aria-modal="true" aria-label="Filtrar por etiqueta" onClick={(event) => event.stopPropagation()}>
            <div className="folder-dialog__header">
              <div><strong>Filtrar por etiqueta</strong><span>Combina el filtro con la carpeta seleccionada</span></div>
              <button type="button" onClick={() => setTagFilterOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="folder-move-list">
              <button type="button" className={activeTagId === 'all' ? 'folder-move-option folder-move-option--active' : 'folder-move-option'} onClick={() => void handleSelectTag('all')}>
                <span aria-hidden="true">🏷</span><strong>Todas las etiquetas</strong>{activeTagId === 'all' && <span aria-hidden="true">✓</span>}
              </button>
              {tags.map((tag) => (
                <button type="button" key={tag.id} className={activeTagId === tag.id ? 'folder-move-option folder-move-option--active' : 'folder-move-option'} onClick={() => void handleSelectTag(tag.id)}>
                  <span aria-hidden="true">#</span><strong>{tag.name}</strong>{activeTagId === tag.id && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tagManagerOpen && (
        <div className="folder-dialog" role="presentation" onClick={() => setTagManagerOpen(false)}>
          <div className="folder-dialog__panel" role="dialog" aria-modal="true" aria-label="Administrar etiquetas" onClick={(event) => event.stopPropagation()}>
            <div className="folder-dialog__header">
              <div><strong>Etiquetas</strong><span>Clasificación cifrada y reutilizable</span></div>
              <button type="button" onClick={() => setTagManagerOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="folder-create-row">
              <input
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void handleCreateTag() }}
                maxLength={40}
                placeholder="Nueva etiqueta"
                aria-label="Nombre de nueva etiqueta"
              />
              <button type="button" onClick={() => void handleCreateTag()} disabled={creatingTag}>
                {creatingTag ? 'Creando…' : 'Crear'}
              </button>
            </div>
            <div className="folder-list">
              {tags.length === 0 ? (
                <p className="folder-list__empty">Aún no has creado etiquetas.</p>
              ) : tags.map((tag) => (
                <div className="folder-list__row" key={tag.id}>
                  {editingTagId === tag.id ? (
                    <>
                      <input
                        className="folder-list__rename"
                        value={editingTagName}
                        onChange={(event) => setEditingTagName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void handleRenameTag(tag)
                          if (event.key === 'Escape') setEditingTagId(null)
                        }}
                        maxLength={40}
                        autoFocus
                        aria-label={`Nuevo nombre para ${tag.name}`}
                      />
                      <div className="folder-list__actions">
                        <button type="button" onClick={() => void handleRenameTag(tag)} disabled={tagBusyId === tag.id}>Guardar</button>
                        <button type="button" onClick={() => setEditingTagId(null)}>Cancelar</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="folder-list__identity">
                        <span aria-hidden="true">🏷</span>
                        <div><strong>{tag.name}</strong><small>{notes.filter((note) => (note.tagIds ?? []).includes(tag.id)).length} notas</small></div>
                      </div>
                      <div className="folder-list__actions">
                        <button type="button" onClick={() => beginTagRename(tag)}>Renombrar</button>
                        <button className="folder-list__delete" type="button" onClick={() => void handleDeleteTag(tag)} disabled={tagBusyId === tag.id}>Eliminar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tagEditorNote && (
        <div className="folder-dialog" role="presentation" onClick={() => setTagEditorNoteId(null)}>
          <div className="folder-dialog__panel folder-dialog__panel--move tag-dialog__panel--assign" role="dialog" aria-modal="true" aria-label="Etiquetas de la nota" onClick={(event) => event.stopPropagation()}>
            <div className="folder-dialog__header">
              <div><strong>Etiquetas de la nota</strong><span>{tagEditorNote.title}</span></div>
              <button type="button" onClick={() => setTagEditorNoteId(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="tag-assign-list">
              {tags.length === 0 ? (
                <div className="tag-assign-empty">
                  <span aria-hidden="true">🏷</span>
                  <strong>Aún no hay etiquetas</strong>
                  <button type="button" onClick={() => { setTagEditorNoteId(null); setTagManagerOpen(true) }}>Crear etiqueta</button>
                </div>
              ) : tags.map((tag) => (
                <label className="tag-assign-option" key={tag.id}>
                  <input type="checkbox" checked={tagDraftIds.includes(tag.id)} onChange={() => toggleTagDraft(tag.id)} />
                  <span aria-hidden="true">#</span>
                  <strong>{tag.name}</strong>
                </label>
              ))}
            </div>
            <div className="tag-dialog__footer">
              <button type="button" onClick={() => setTagEditorNoteId(null)}>Cancelar</button>
              <button className="tag-dialog__save" type="button" onClick={() => void handleSaveNoteTags()} disabled={savingNoteTags || tags.length === 0}>
                {savingNoteTags ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {moveTargetNote && (
''',
)

# ---------------------------------------------------------------------------
# Responsive tag UI styles.
# ---------------------------------------------------------------------------
append_once(
    'src/features/notes/notes.css',
    '/* OANIX V1 tags */',
    r'''
/* OANIX V1 tags */
.notes-tag-filter {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 2.7rem;
  gap: .4rem;
  padding: .45rem .7rem;
  border-bottom: 1px solid #edf1f5;
  background: #fbfcfe;
}
.tag-filter-button,
.tag-manage-button {
  min-width: 0;
  min-height: 2.45rem;
  border: 1px solid #dce4ed;
  border-radius: .72rem;
  background: #fff;
  color: #52606f;
  font: inherit;
  font-size: .78rem;
  font-weight: 800;
}
.tag-filter-button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: .45rem;
  padding: .45rem .65rem;
  text-align: left;
}
.tag-filter-button > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag-filter-button--active { border-color: #bfd3ff; background: #eef4ff; color: #1d4ed8; }
.tag-filter-button:hover,
.tag-filter-button:focus-visible,
.tag-manage-button:hover,
.tag-manage-button:focus-visible { outline: none; border-color: #a9c3ff; background: #f3f7ff; color: #1d4ed8; }
.tag-manage-button { display: grid; place-items: center; padding: 0; font-size: 1.1rem; color: #2563eb; }

.note-tag-strip {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .4rem;
  margin-top: .75rem;
}
.note-tag-chip,
.note-tag-add {
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: .35rem .6rem;
  border-radius: 999px;
  font-size: .72rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.note-tag-chip { border: 1px solid #cfe0ff; background: #eef4ff; color: #1d4ed8; }
.note-tag-add { border: 1px dashed #c5cfdb; background: transparent; color: #64748b; font: inherit; }
.note-tag-add:hover,
.note-tag-add:focus-visible { outline: none; border-color: #93b4ff; background: #f4f7ff; color: #1d4ed8; }

.tag-dialog__panel--assign { grid-template-rows: auto minmax(0, 1fr) auto; }
.tag-assign-list { min-height: 0; overflow-y: auto; display: grid; align-content: start; gap: .3rem; padding: .6rem; }
.tag-assign-option {
  min-width: 0;
  min-height: 3rem;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: .65rem;
  padding: .65rem .75rem;
  border-radius: .75rem;
  color: #334155;
  font-size: .84rem;
  cursor: pointer;
}
.tag-assign-option:hover { background: #f4f7fb; }
.tag-assign-option input { width: 1.1rem; height: 1.1rem; margin: 0; accent-color: #2563eb; }
.tag-assign-option strong { min-width: 0; overflow-wrap: anywhere; }
.tag-assign-empty { min-height: 12rem; display: grid; place-items: center; align-content: center; gap: .5rem; padding: 1rem; color: #718096; text-align: center; }
.tag-assign-empty > span { font-size: 1.6rem; }
.tag-assign-empty button { min-height: 2.4rem; padding: .45rem .75rem; border: 1px solid #cfd8e3; border-radius: .65rem; background: #fff; color: #2563eb; font: inherit; font-weight: 800; }
.tag-dialog__footer { display: flex; justify-content: flex-end; gap: .5rem; padding: .75rem; border-top: 1px solid #e8edf2; background: #fbfcfe; }
.tag-dialog__footer button { min-height: 2.55rem; padding: .5rem .85rem; border: 1px solid #d5dde7; border-radius: .68rem; background: #fff; color: #475569; font: inherit; font-weight: 800; }
.tag-dialog__footer .tag-dialog__save { border-color: #2563eb; background: #2563eb; color: #fff; }

@media (max-width: 380px) {
  .notes-tag-filter { grid-template-columns: minmax(0, 1fr) 2.55rem; padding-inline: .55rem; }
  .tag-dialog__footer { display: grid; grid-template-columns: 1fr 1fr; }
}
''',
)

# ---------------------------------------------------------------------------
# Roadmap and changelog.
# ---------------------------------------------------------------------------
replace_once(
    'docs/ROADMAP.md',
    '- [ ] Etiquetas\n- [ ] Búsqueda local\n',
    '- [x] Etiquetas\n- [ ] Búsqueda local\n',
)
replace_once(
    'docs/ROADMAP.md',
    '**Siguiente bloque de trabajo:** Etiquetas.\n',
    '**Siguiente bloque de trabajo:** Búsqueda local.\n',
)

change = '- Etiquetas V1 cifradas: CRUD, asignación múltiple por nota, filtro combinado con carpetas, chips en la nota y eliminación sin borrar contenido.\n'
changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
marker = '## Unreleased\n'
if change not in text:
    changelog.write_text(text.replace(marker, marker + change, 1), encoding='utf-8')
