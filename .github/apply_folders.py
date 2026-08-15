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
# Note ↔ folder relationship (kept inside the encrypted note record).
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/noteTypes.ts',
    '''export interface NoteRecord {\n  version: 1\n  id: string\n  title: string\n  createdAt: string\n  updatedAt: string\n  content: {\n''',
    '''export interface NoteRecord {\n  version: 1\n  id: string\n  title: string\n  createdAt: string\n  updatedAt: string\n  folderId?: string | null\n  content: {\n''',
)
replace_once(
    'src/features/notes/noteTypes.ts',
    '''    typeof note.createdAt === 'string' &&\n    typeof note.updatedAt === 'string' &&\n    !!note.content &&\n''',
    '''    typeof note.createdAt === 'string' &&\n    typeof note.updatedAt === 'string' &&\n    (note.folderId === undefined || note.folderId === null || typeof note.folderId === 'string') &&\n    !!note.content &&\n''',
)

replace_once(
    'src/features/notes/noteService.ts',
    '''export async function createEmptyNote(): Promise<NoteRecord> {\n  const nowDate = new Date()\n''',
    '''export async function createEmptyNote(folderId: string | null = null): Promise<NoteRecord> {\n  const nowDate = new Date()\n''',
)
replace_once(
    'src/features/notes/noteService.ts',
    '''    title: DEFAULT_NOTE_TITLE,\n    createdAt: now,\n    updatedAt: now,\n    content: {\n''',
    '''    title: DEFAULT_NOTE_TITLE,\n    createdAt: now,\n    updatedAt: now,\n    folderId,\n    content: {\n''',
)
append_once(
    'src/features/notes/noteService.ts',
    'export function moveNoteToFolder',
    '''export function moveNoteToFolder(noteId: string, folderId: string | null): Promise<NoteRecord> {\n  return enqueueNoteMutation(noteId, (existing) => ({\n    ...existing,\n    folderId,\n  }))\n}\n''',
)

# ---------------------------------------------------------------------------
# Notes workspace: folder tabs, manager and move-note dialog.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''import { deleteEncryptedImage } from '../images/imageService'\nimport { storageSaveErrorMessage } from '../../storage/local/storageErrors'\n''',
    '''import { deleteEncryptedImage } from '../images/imageService'\nimport { createFolder, deleteFolder, loadFolders, renameFolder } from '../folders/folderService'\nimport type { FolderRecord } from '../folders/folderTypes'\nimport { storageSaveErrorMessage } from '../../storage/local/storageErrors'\n''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''import { createEmptyNote, deleteNote, loadNotes, renameNote, replaceNoteContent } from './noteService'\n''',
    '''import { createEmptyNote, deleteNote, loadNotes, moveNoteToFolder, renameNote, replaceNoteContent } from './noteService'\n''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  const [notes, setNotes] = useState<NoteRecord[]>([])\n  const [selectedId, setSelectedId] = useState<string | null>(null)\n''',
    '''  const [notes, setNotes] = useState<NoteRecord[]>([])\n  const [folders, setFolders] = useState<FolderRecord[]>([])\n  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all')\n  const [folderManagerOpen, setFolderManagerOpen] = useState(false)\n  const [newFolderName, setNewFolderName] = useState('')\n  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)\n  const [editingFolderName, setEditingFolderName] = useState('')\n  const [folderBusyId, setFolderBusyId] = useState<string | null>(null)\n  const [creatingFolder, setCreatingFolder] = useState(false)\n  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)\n  const [selectedId, setSelectedId] = useState<string | null>(null)\n''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  const deletingSelected = !!selectedNote && deletingId === selectedNote.id\n\n  useEffect(() => {\n''',
    '''  const deletingSelected = !!selectedNote && deletingId === selectedNote.id\n  const visibleNotes = useMemo(\n    () => activeFolderId === 'all'\n      ? notes\n      : notes.filter((note) => note.folderId === activeFolderId),\n    [notes, activeFolderId],\n  )\n  const moveTargetNote = useMemo(\n    () => notes.find((note) => note.id === moveNoteId) ?? null,\n    [notes, moveNoteId],\n  )\n\n  useEffect(() => {\n''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''    void loadNotes()\n      .then((storedNotes) => {\n        if (!active) return\n        setNotes(storedNotes)\n      })\n      .catch(() => {\n        if (!active) return\n        setError('No se pudieron cargar las notas cifradas de este dispositivo.')\n      })\n''',
    '''    void Promise.all([loadNotes(), loadFolders()])\n      .then(([storedNotes, storedFolders]) => {\n        if (!active) return\n        setNotes(storedNotes)\n        setFolders(storedFolders)\n      })\n      .catch(() => {\n        if (!active) return\n        setError('No se pudieron cargar las notas y carpetas cifradas de este dispositivo.')\n      })\n''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''        setActiveNoteMenuOpen(false)\n        setNoteInfoOpen(false)\n      }\n''',
    '''        setActiveNoteMenuOpen(false)\n        setNoteInfoOpen(false)\n        setMoveNoteId(null)\n        setFolderManagerOpen(false)\n      }\n''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  function clearSaveTimer() {\n''',
    '''  function sortFolderState(nextFolders: FolderRecord[]): FolderRecord[] {\n    return [...nextFolders].sort((left, right) =>\n      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),\n    )\n  }\n\n  function folderName(folderId: string | null | undefined): string {\n    if (!folderId) return 'Sin carpeta'\n    return folders.find((folder) => folder.id === folderId)?.name ?? 'Carpeta no disponible'\n  }\n\n  function clearSaveTimer() {\n''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  async function handleCreateNote() {\n    if (!(await flushPendingContent())) return\n''',
    '''  async function handleCreateNote() {\n    if (!(await flushPendingContent())) return\n''',
)
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''      const note = await createEmptyNote()\n''',
    '''      const note = await createEmptyNote(activeFolderId === 'all' ? null : activeFolderId)\n''',
)

# Insert folder handlers before title persistence.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''  async function persistTitle() {\n''',
    '''  function folderNameExists(name: string, exceptId?: string): boolean {\n    const candidate = name.trim().replace(/\\s+/g, ' ').toLocaleLowerCase()\n    return folders.some((folder) =>\n      folder.id !== exceptId && folder.name.toLocaleLowerCase() === candidate,\n    )\n  }\n\n  async function handleCreateFolder() {\n    const name = newFolderName.trim().replace(/\\s+/g, ' ')\n    if (!name) {\n      setError('Escribe un nombre para la carpeta.')\n      return\n    }\n    if (folderNameExists(name)) {\n      setError('Ya existe una carpeta con ese nombre.')\n      return\n    }\n\n    setCreatingFolder(true)\n    setError('')\n    try {\n      const folder = await createFolder(name)\n      setFolders((current) => sortFolderState([...current, folder]))\n      setNewFolderName('')\n      setActiveFolderId(folder.id)\n    } catch (folderError) {\n      setError(folderError instanceof Error ? folderError.message : 'No se pudo crear la carpeta cifrada.')\n    } finally {\n      setCreatingFolder(false)\n    }\n  }\n\n  function beginFolderRename(folder: FolderRecord) {\n    setEditingFolderId(folder.id)\n    setEditingFolderName(folder.name)\n    setError('')\n  }\n\n  async function handleRenameFolder(folder: FolderRecord) {\n    const name = editingFolderName.trim().replace(/\\s+/g, ' ')\n    if (!name) {\n      setError('El nombre de la carpeta no puede estar vacío.')\n      return\n    }\n    if (folderNameExists(name, folder.id)) {\n      setError('Ya existe una carpeta con ese nombre.')\n      return\n    }\n\n    setFolderBusyId(folder.id)\n    setError('')\n    try {\n      const updated = await renameFolder(folder.id, name)\n      setFolders((current) => sortFolderState(\n        current.map((item) => item.id === updated.id ? updated : item),\n      ))\n      setEditingFolderId(null)\n      setEditingFolderName('')\n    } catch (folderError) {\n      setError(folderError instanceof Error ? folderError.message : 'No se pudo renombrar la carpeta.')\n    } finally {\n      setFolderBusyId(null)\n    }\n  }\n\n  async function handleMoveNote(targetNote: NoteRecord, folderId: string | null) {\n    if (targetNote.id === selectedIdRef.current && !(await flushPendingContent())) return\n\n    setFolderBusyId(targetNote.id)\n    setError('')\n    try {\n      const updated = await moveNoteToFolder(targetNote.id, folderId)\n      replaceNoteInState(updated)\n      setMoveNoteId(null)\n      setNoteMenuId(null)\n      setActiveNoteMenuOpen(false)\n    } catch {\n      setError('No se pudo mover la nota a la carpeta seleccionada.')\n    } finally {\n      setFolderBusyId(null)\n    }\n  }\n\n  async function handleDeleteFolder(folder: FolderRecord) {\n    const affected = notes.filter((note) => note.folderId === folder.id)\n    const detail = affected.length === 0\n      ? 'La carpeta se eliminará. No contiene notas.'\n      : `La carpeta se eliminará y ${affected.length} nota${affected.length === 1 ? '' : 's'} volverá${affected.length === 1 ? '' : 'n'} a “Sin carpeta”.`\n    if (!window.confirm(`¿Eliminar la carpeta “${folder.name}”?\\n\\n${detail}\\n\\nLas notas NO se eliminarán.`)) return\n\n    if (!(await flushPendingContent())) return\n    setFolderBusyId(folder.id)\n    setError('')\n    try {\n      const movedNotes = await Promise.all(affected.map((note) => moveNoteToFolder(note.id, null)))\n      if (movedNotes.length > 0) {\n        const movedById = new Map(movedNotes.map((note) => [note.id, note]))\n        setNotes((current) => current.map((note) => movedById.get(note.id) ?? note))\n      }\n      await deleteFolder(folder.id)\n      setFolders((current) => current.filter((item) => item.id !== folder.id))\n      if (activeFolderId === folder.id) setActiveFolderId('all')\n      if (editingFolderId === folder.id) {\n        setEditingFolderId(null)\n        setEditingFolderName('')\n      }\n    } catch {\n      setError('No se pudo completar la eliminación de la carpeta.')\n    } finally {\n      setFolderBusyId(null)\n    }\n  }\n\n  async function persistTitle() {\n''',
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''    const estimatedMenuHeight = 58\n''',
    '''    const estimatedMenuHeight = 108\n''',
)

# Workspace menu gets folder management.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''                <div className="workspace-menu" role="menu" aria-label="Acciones de OANIX">\n                  <button\n                    type="button"\n                    role="menuitem"\n                    onClick={() => {\n                      setWorkspaceMenuOpen(false)\n                      window.alert('OANIX V1 · bóveda local cifrada · offline-first')\n                    }}\n                  >\n                    <span aria-hidden="true">ⓘ</span> Acerca de OANIX\n                  </button>\n                </div>\n''',
    '''                <div className="workspace-menu" role="menu" aria-label="Acciones de OANIX">\n                  <button\n                    type="button"\n                    role="menuitem"\n                    onClick={() => {\n                      setWorkspaceMenuOpen(false)\n                      setFolderManagerOpen(true)\n                    }}\n                  >\n                    <span aria-hidden="true">📁</span> Administrar carpetas\n                  </button>\n                  <button\n                    type="button"\n                    role="menuitem"\n                    onClick={() => {\n                      setWorkspaceMenuOpen(false)\n                      window.alert('OANIX V1 · bóveda local cifrada · offline-first')\n                    }}\n                  >\n                    <span aria-hidden="true">ⓘ</span> Acerca de OANIX\n                  </button>\n                </div>\n''',
)

# Folder tabs replace the placeholder “Todas” tab.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''        <nav className="notes-tabs" aria-label="Carpetas de notas">\n          <button className="notes-tab notes-tab--active" type="button" aria-current="page">\n            Todas\n          </button>\n        </nav>\n''',
    '''        <nav className="notes-tabs" aria-label="Carpetas de notas">\n          <button\n            className={`notes-tab${activeFolderId === 'all' ? ' notes-tab--active' : ''}`}\n            type="button"\n            aria-current={activeFolderId === 'all' ? 'page' : undefined}\n            onClick={() => setActiveFolderId('all')}\n          >\n            Todas\n          </button>\n          {folders.map((folder) => (\n            <button\n              className={`notes-tab${activeFolderId === folder.id ? ' notes-tab--active' : ''}`}\n              type="button"\n              key={folder.id}\n              aria-current={activeFolderId === folder.id ? 'page' : undefined}\n              title={folder.name}\n              onClick={() => setActiveFolderId(folder.id)}\n            >\n              {folder.name}\n            </button>\n          ))}\n          <button\n            className="notes-tab notes-tab--add"\n            type="button"\n            aria-label="Crear o administrar carpetas"\n            title="Carpetas"\n            onClick={() => setFolderManagerOpen(true)}\n          >\n            ＋\n          </button>\n        </nav>\n''',
)

# Filter list and provide folder-specific empty state.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''          ) : notes.length === 0 ? (\n            <div className="notes-empty">\n              <div className="notes-empty__icon" aria-hidden="true">✎</div>\n              <strong>Aún no hay notas</strong>\n              <p>Crea la primera. Se guardará cifrada en este dispositivo.</p>\n              <button className="empty-action" type="button" onClick={() => void handleCreateNote()} disabled={creating}>\n                Crear primera nota\n              </button>\n            </div>\n          ) : (\n            notes.map((note) => (\n''',
    '''          ) : notes.length === 0 ? (\n            <div className="notes-empty">\n              <div className="notes-empty__icon" aria-hidden="true">✎</div>\n              <strong>Aún no hay notas</strong>\n              <p>Crea la primera. Se guardará cifrada en este dispositivo.</p>\n              <button className="empty-action" type="button" onClick={() => void handleCreateNote()} disabled={creating}>\n                Crear primera nota\n              </button>\n            </div>\n          ) : visibleNotes.length === 0 ? (\n            <div className="notes-empty">\n              <div className="notes-empty__icon" aria-hidden="true">📁</div>\n              <strong>Esta carpeta está vacía</strong>\n              <p>Las notas que crees aquí quedarán organizadas en esta carpeta cifrada.</p>\n              <button className="empty-action" type="button" onClick={() => void handleCreateNote()} disabled={creating}>\n                Crear nota aquí\n              </button>\n            </div>\n          ) : (\n            visibleNotes.map((note) => (\n''',
)

# Row menu: move before delete.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''                    >\n                      <button\n                        className="note-row__menu-danger"\n''',
    '''                    >\n                      <button\n                        type="button"\n                        role="menuitem"\n                        onClick={() => {\n                          setNoteMenuId(null)\n                          setMoveNoteId(note.id)\n                        }}\n                      >\n                        Mover a carpeta\n                      </button>\n                      <button\n                        className="note-row__menu-danger"\n''',
)

# Active note menu: move before information/delete.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''                  <div className="note-view__menu" role="menu" aria-label="Acciones de la nota">\n                    <button\n                      type="button"\n                      role="menuitem"\n                      onClick={() => {\n                        setActiveNoteMenuOpen(false)\n                        setNoteInfoOpen(true)\n                      }}\n                    >\n''',
    '''                  <div className="note-view__menu" role="menu" aria-label="Acciones de la nota">\n                    <button\n                      type="button"\n                      role="menuitem"\n                      onClick={() => {\n                        setActiveNoteMenuOpen(false)\n                        setMoveNoteId(selectedNote.id)\n                      }}\n                    >\n                      <span aria-hidden="true">📁</span> Mover a carpeta\n                    </button>\n                    <button\n                      type="button"\n                      role="menuitem"\n                      onClick={() => {\n                        setActiveNoteMenuOpen(false)\n                        setNoteInfoOpen(true)\n                      }}\n                    >\n''',
)

# Note info includes current folder.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''                <div><dt>Modificada</dt><dd>{new Date(selectedNote.updatedAt).toLocaleString('es-HN')}</dd></div>\n                <div><dt>Bloques</dt><dd>{selectedNote.content.blocks.length}</dd></div>\n''',
    '''                <div><dt>Modificada</dt><dd>{new Date(selectedNote.updatedAt).toLocaleString('es-HN')}</dd></div>\n                <div><dt>Carpeta</dt><dd>{folderName(selectedNote.folderId)}</dd></div>\n                <div><dt>Bloques</dt><dd>{selectedNote.content.blocks.length}</dd></div>\n''',
)

# Global folder manager + move dialog before closing main.
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''      </section>\n    </main>\n  )\n}\n''',
    '''      </section>\n\n      {folderManagerOpen && (\n        <div className="folder-dialog" role="presentation" onClick={() => setFolderManagerOpen(false)}>\n          <div className="folder-dialog__panel" role="dialog" aria-modal="true" aria-label="Administrar carpetas" onClick={(event) => event.stopPropagation()}>\n            <div className="folder-dialog__header">\n              <div><strong>Carpetas</strong><span>Organización cifrada de tus notas</span></div>\n              <button type="button" onClick={() => setFolderManagerOpen(false)} aria-label="Cerrar">×</button>\n            </div>\n            <div className="folder-create-row">\n              <input\n                value={newFolderName}\n                onChange={(event) => setNewFolderName(event.target.value)}\n                onKeyDown={(event) => { if (event.key === 'Enter') void handleCreateFolder() }}\n                maxLength={60}\n                placeholder="Nueva carpeta"\n                aria-label="Nombre de nueva carpeta"\n              />\n              <button type="button" onClick={() => void handleCreateFolder()} disabled={creatingFolder}>\n                {creatingFolder ? 'Creando…' : 'Crear'}\n              </button>\n            </div>\n            <div className="folder-list">\n              {folders.length === 0 ? (\n                <p className="folder-list__empty">Aún no has creado carpetas.</p>\n              ) : folders.map((folder) => (\n                <div className="folder-list__row" key={folder.id}>\n                  {editingFolderId === folder.id ? (\n                    <>\n                      <input\n                        className="folder-list__rename"\n                        value={editingFolderName}\n                        onChange={(event) => setEditingFolderName(event.target.value)}\n                        onKeyDown={(event) => {\n                          if (event.key === 'Enter') void handleRenameFolder(folder)\n                          if (event.key === 'Escape') setEditingFolderId(null)\n                        }}\n                        maxLength={60}\n                        autoFocus\n                        aria-label={`Nuevo nombre para ${folder.name}`}\n                      />\n                      <div className="folder-list__actions">\n                        <button type="button" onClick={() => void handleRenameFolder(folder)} disabled={folderBusyId === folder.id}>Guardar</button>\n                        <button type="button" onClick={() => setEditingFolderId(null)}>Cancelar</button>\n                      </div>\n                    </>\n                  ) : (\n                    <>\n                      <div className="folder-list__identity">\n                        <span aria-hidden="true">📁</span>\n                        <div><strong>{folder.name}</strong><small>{notes.filter((note) => note.folderId === folder.id).length} notas</small></div>\n                      </div>\n                      <div className="folder-list__actions">\n                        <button type="button" onClick={() => beginFolderRename(folder)}>Renombrar</button>\n                        <button className="folder-list__delete" type="button" onClick={() => void handleDeleteFolder(folder)} disabled={folderBusyId === folder.id}>Eliminar</button>\n                      </div>\n                    </>\n                  )}\n                </div>\n              ))}\n            </div>\n          </div>\n        </div>\n      )}\n\n      {moveTargetNote && (\n        <div className="folder-dialog" role="presentation" onClick={() => setMoveNoteId(null)}>\n          <div className="folder-dialog__panel folder-dialog__panel--move" role="dialog" aria-modal="true" aria-label="Mover nota a carpeta" onClick={(event) => event.stopPropagation()}>\n            <div className="folder-dialog__header">\n              <div><strong>Mover nota</strong><span>{moveTargetNote.title}</span></div>\n              <button type="button" onClick={() => setMoveNoteId(null)} aria-label="Cerrar">×</button>\n            </div>\n            <div className="folder-move-list">\n              <button type="button" className={!moveTargetNote.folderId ? 'folder-move-option folder-move-option--active' : 'folder-move-option'} onClick={() => void handleMoveNote(moveTargetNote, null)} disabled={folderBusyId === moveTargetNote.id}>\n                <span aria-hidden="true">📄</span><strong>Sin carpeta</strong>{!moveTargetNote.folderId && <span aria-hidden="true">✓</span>}\n              </button>\n              {folders.map((folder) => (\n                <button type="button" key={folder.id} className={moveTargetNote.folderId === folder.id ? 'folder-move-option folder-move-option--active' : 'folder-move-option'} onClick={() => void handleMoveNote(moveTargetNote, folder.id)} disabled={folderBusyId === moveTargetNote.id}>\n                  <span aria-hidden="true">📁</span><strong>{folder.name}</strong>{moveTargetNote.folderId === folder.id && <span aria-hidden="true">✓</span>}\n                </button>\n              ))}\n            </div>\n          </div>\n        </div>\n      )}\n    </main>\n  )\n}\n''',
)

# ---------------------------------------------------------------------------
# Responsive folder UI. Tabs remain one fluid component across screen sizes.
# ---------------------------------------------------------------------------
append_once(
    'src/features/notes/notes.css',
    '/* OANIX V1 folders */',
    '''/* OANIX V1 folders */\n.notes-tab {\n  max-width: min(12rem, 46vw);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.notes-tab--add {\n  min-width: 2.9rem;\n  width: 2.9rem;\n  padding-inline: .4rem;\n  color: #2563eb;\n  font-size: 1.2rem;\n}\n.folder-dialog {\n  position: fixed;\n  z-index: 1900;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  padding: clamp(.65rem, 2vw, 1.25rem);\n  background: rgba(15,23,42,.42);\n  backdrop-filter: blur(4px);\n}\n.folder-dialog__panel {\n  width: min(35rem, 100%);\n  max-height: min(82dvh, 44rem);\n  display: grid;\n  grid-template-rows: auto auto minmax(0,1fr);\n  overflow: hidden;\n  border: 1px solid #d9e0e7;\n  border-radius: 1.15rem;\n  background: #fff;\n  box-shadow: 0 24px 70px rgba(15,23,42,.28);\n}\n.folder-dialog__panel--move { grid-template-rows: auto minmax(0,1fr); width: min(30rem, 100%); }\n.folder-dialog__header {\n  min-width: 0;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: .75rem;\n  padding: clamp(.8rem, 2.5vw, 1.05rem);\n  border-bottom: 1px solid #e5eaf0;\n}\n.folder-dialog__header > div { min-width: 0; }\n.folder-dialog__header strong,\n.folder-dialog__header span { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.folder-dialog__header span { margin-top: .1rem; color: #7a8593; font-size: .76rem; }\n.folder-dialog__header > button {\n  width: 2.5rem; height: 2.5rem; display: grid; place-items: center; flex: 0 0 auto;\n  border: 0; border-radius: 50%; background: transparent; color: #64748b; font: inherit; font-size: 1.5rem;\n}\n.folder-dialog__header > button:hover, .folder-dialog__header > button:focus-visible { outline: none; background: #eef2f7; }\n.folder-create-row {\n  display: grid;\n  grid-template-columns: minmax(0,1fr) auto;\n  gap: .55rem;\n  padding: .85rem clamp(.8rem, 2.5vw, 1.05rem);\n  border-bottom: 1px solid #edf1f5;\n}\n.folder-create-row input, .folder-list__rename {\n  min-width: 0; min-height: 2.65rem; padding: .55rem .7rem; border: 1px solid #cfd8e3; border-radius: .7rem; outline: none; background: #fff; color: #172033; font: inherit;\n}\n.folder-create-row input:focus, .folder-list__rename:focus { border-color: #93b4ff; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }\n.folder-create-row button, .folder-list__actions button {\n  min-height: 2.5rem; padding: .45rem .7rem; border: 1px solid #d8e0ea; border-radius: .65rem; background: #f8fafc; color: #334155; font: inherit; font-size: .78rem; font-weight: 800;\n}\n.folder-create-row > button { border-color: #2563eb; background: #2563eb; color: #fff; }\n.folder-list, .folder-move-list { min-height: 0; overflow-y: auto; padding: .55rem; }\n.folder-list__empty { margin: 1.2rem; color: #7a8593; text-align: center; }\n.folder-list__row {\n  min-width: 0; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: .65rem; padding: .65rem; border-radius: .8rem;\n}\n.folder-list__row:hover { background: #f8fafc; }\n.folder-list__identity { min-width: 0; display: flex; align-items: center; gap: .65rem; }\n.folder-list__identity > span { flex: 0 0 auto; }\n.folder-list__identity > div { min-width: 0; }\n.folder-list__identity strong, .folder-list__identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.folder-list__identity small { margin-top: .08rem; color: #87919d; font-size: .7rem; }\n.folder-list__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .35rem; }\n.folder-list__delete { color: #b42318 !important; }\n.folder-list__rename { width: 100%; }\n.folder-move-list { display: grid; gap: .25rem; }\n.folder-move-option {\n  width: 100%; min-width: 0; min-height: 3rem; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: .7rem; padding: .65rem .75rem; border: 0; border-radius: .75rem; background: transparent; color: #334155; font: inherit; text-align: left;\n}\n.folder-move-option strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.folder-move-option:hover, .folder-move-option:focus-visible { outline: none; background: #f1f5f9; }\n.folder-move-option--active { background: #eef4ff; color: #1d4ed8; }\n@media (max-width: 760px) {\n  .folder-dialog { place-items: end center; padding: 0; }\n  .folder-dialog__panel, .folder-dialog__panel--move { width: 100%; max-height: min(78dvh, 44rem); border-right: 0; border-bottom: 0; border-left: 0; border-radius: 1.2rem 1.2rem 0 0; }\n}\n@media (max-width: 380px) {\n  .folder-create-row { grid-template-columns: 1fr; }\n  .folder-list__row { grid-template-columns: 1fr; }\n  .folder-list__actions { justify-content: flex-start; }\n}\n''',
)

# ---------------------------------------------------------------------------
# Tests + docs.
# ---------------------------------------------------------------------------
Path('tests/folders.test.ts').write_text('''import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport { isFolderRecord, normalizeFolderName, type FolderRecord } from '../src/features/folders/folderTypes.ts'\nimport { isNoteRecord, type NoteRecord } from '../src/features/notes/noteTypes.ts'\n\nfunction folder(overrides: Partial<FolderRecord> = {}): FolderRecord {\n  return { version: 1, id: 'folder-test-1', name: 'Trabajo', createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z', ...overrides }\n}\n\nfunction note(folderId?: string | null): NoteRecord {\n  return { version: 1, id: 'note-folder-test', title: 'Nota', createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z', ...(folderId !== undefined ? { folderId } : {}), content: { format: 'blocks-v1', blocks: [] } }\n}\n\ntest('folder names are normalized without losing internal words', () => {\n  assert.equal(normalizeFolderName('  Trabajo   personal  '), 'Trabajo personal')\n})\n\ntest('encrypted folder records have a strict local model', () => {\n  assert.equal(isFolderRecord(folder()), true)\n  assert.equal(isFolderRecord(folder({ name: '' })), false)\n  assert.equal(isFolderRecord({ ...folder(), version: 2 }), false)\n})\n\ntest('notes remain backwards compatible without folderId', () => {\n  assert.equal(isNoteRecord(note()), true)\n})\n\ntest('notes accept an encrypted folder relationship or explicit no-folder state', () => {\n  assert.equal(isNoteRecord(note('folder-test-1')), true)\n  assert.equal(isNoteRecord(note(null)), true)\n  assert.equal(isNoteRecord({ ...note(), folderId: 123 }), false)\n})\n''', encoding='utf-8')

replace_once(
    'docs/ROADMAP.md',
    '''- [ ] Carpetas\n- [ ] Etiquetas\n''',
    '''- [x] Carpetas\n- [ ] Etiquetas\n''',
)
replace_once(
    'docs/ROADMAP.md',
    '''**Siguiente bloque de trabajo:** Carpetas.\n''',
    '''**Siguiente bloque de trabajo:** Etiquetas.\n''',
)
append_once(
    'docs/CHANGELOG.md',
    'Carpetas cifradas V1',
    '''- Carpetas cifradas V1: creación, renombrado, eliminación sin borrar notas, pestañas de filtro, creación contextual de notas y movimiento entre carpetas desde `⋮`.\n''',
)
append_once(
    'docs/ARCHITECTURE.md',
    '## Carpetas V1',
    '''## Carpetas V1\n\n- Las carpetas son registros cifrados independientes de tipo `folder`; sus nombres no se almacenan en texto plano.\n- Cada nota guarda opcionalmente `folderId` dentro de su propio registro cifrado; notas antiguas sin este campo siguen siendo válidas.\n- Eliminar una carpeta nunca elimina notas: primero se desvinculan y vuelven al estado `Sin carpeta`.\n- La lista usa una única fila de pestañas fluida para `Todas` y las carpetas creadas; la misma estructura funciona en móvil, tablet y PC.\n''',
)
