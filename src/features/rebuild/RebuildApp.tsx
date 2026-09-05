import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { AccountPanel } from '../account/AccountPanel'
import { EditorSurface } from '../editor/EditorSurface'
import type {
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceSnapshot,
} from '../editor/editorSurfaceContract'
import { OanixIcon } from '../../shared/OanixIcon'
import {
  AUTO_LOCK_OPTIONS,
  readSavedAutoLockMinutes,
  saveAutoLockMinutes,
  type AutoLockMinutes,
} from '../../security/session/autoLockPolicy'
import {
  applyOanixTheme,
  readSavedOanixTheme,
  type OanixThemePreset,
} from '../personalization/themeCatalog'
import { readRebuildBlocks, saveRebuildBlocks } from './rebuildBlockService'
import {
  deleteRebuildFolder,
  deleteRebuildNote,
  deleteRebuildTag,
} from './rebuildDeletionService'
import {
  createEditorSaveCoordinator,
  type EditorSaveCoordinator,
} from './editorSaveCoordinator'
import {
  createRebuildFolder,
  createRebuildNote,
  createRebuildTag,
  loadRebuildWorkspace,
  readRebuildNote,
  saveRebuildNote,
  saveRebuildNoteCard,
  saveRebuildNoteFolderOrder,
  saveRebuildNoteOrder,
  type RebuildNoteCardCustomization,
} from './rebuildService'
import {
  folderAccent,
  folderSurfaceCss,
  noteFolderOrder,
  noteHomeOrder,
  type FolderV2Record,
  type NoteV2Meta,
  type TagV2Record,
} from './rebuildModel'
import { NoteCardCustomizationDialog } from './NoteCardCustomizationDialog'
import { NoteListSection } from './NoteListSection'
import { WorkspaceHomeController } from './WorkspaceHomeController'
import './rebuild.css'

interface RebuildAppProps {
  onLock: () => void
}

interface OpenedEditor {
  meta: NoteV2Meta
  text: string
}

type ViewMode = 'home' | 'recents'
type CreateKind = 'chooser' | 'folder' | 'tag' | null
type NoteOrderScope = 'home' | 'folder'

const dateFormatter = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
})
const timeFormatter = new Intl.DateTimeFormat('es', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatNoteTime(iso: string): string {
  const value = new Date(iso)
  const today = new Date()
  if (
    value.getFullYear() === today.getFullYear()
    && value.getMonth() === today.getMonth()
    && value.getDate() === today.getDate()
  ) {
    return timeFormatter.format(value)
  }
  return dateFormatter.format(value)
}

function useDelayedBusy(active: boolean, delay = 600): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [active, delay])

  return visible
}

function folderStyle(folder: FolderV2Record): CSSProperties {
  return {
    '--folder-accent': folderAccent(folder),
    '--folder-soft': folderSurfaceCss(folder, 0.16),
    '--folder-strong': folderSurfaceCss(folder),
  } as CSSProperties
}

function noteOrderForScope(note: NoteV2Meta, scope: NoteOrderScope): number {
  return scope === 'folder' ? noteFolderOrder(note) : noteHomeOrder(note)
}

function orderForMovedNote(
  previous: NoteV2Meta | null,
  next: NoteV2Meta | null,
  scope: NoteOrderScope,
): number | null {
  if (previous && next) {
    const previousOrder = noteOrderForScope(previous, scope)
    const nextOrder = noteOrderForScope(next, scope)
    const midpoint = previousOrder + (nextOrder - previousOrder) / 2
    return midpoint > previousOrder && midpoint < nextOrder ? midpoint : null
  }
  if (previous) return noteOrderForScope(previous, scope) + 1
  if (next) return noteOrderForScope(next, scope) - 1
  return null
}

export function RebuildApp({ onLock }: RebuildAppProps) {
  const [notes, setNotes] = useState<NoteV2Meta[]>([])
  const [folders, setFolders] = useState<FolderV2Record[]>([])
  const [tags, setTags] = useState<TagV2Record[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [activeCover, setActiveCover] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('home')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createKind, setCreateKind] = useState<CreateKind>(null)
  const [createName, setCreateName] = useState('')
  const [editor, setEditor] = useState<OpenedEditor | null>(null)
  const editorRef = useRef<OpenedEditor | null>(null)
  const blockingSaveRef = useRef(false)
  const editorSaveCoordinatorRef = useRef<EditorSaveCoordinator | null>(null)
  if (editorSaveCoordinatorRef.current === null) {
    editorSaveCoordinatorRef.current = createEditorSaveCoordinator()
  }
  const editorSaveCoordinator = editorSaveCoordinatorRef.current
  const [saving, setSaving] = useState(false)
  const [openingNote, setOpeningNote] = useState(false)
  const [customizingNote, setCustomizingNote] = useState<NoteV2Meta | null>(null)
  const [noteCardBusy, setNoteCardBusy] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<OanixThemePreset['id']>(() => readSavedOanixTheme())
  const [autoLockMinutes, setAutoLockMinutes] = useState<AutoLockMinutes>(() => readSavedAutoLockMinutes())
  const searchRef = useRef<HTMLInputElement | null>(null)
  const logoSrc = `${import.meta.env.BASE_URL}oanix-logo.webp`

  const showSavingOverlay = useDelayedBusy(saving)
  const showOpeningOverlay = useDelayedBusy(openingNote)

  useEffect(() => {
    let active = true
    void loadRebuildWorkspace()
      .then((snapshot) => {
        if (!active) return
        setNotes(snapshot.notes)
        setFolders(snapshot.folders)
        setTags(snapshot.tags)
        setError('')
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'No se pudo abrir el nuevo espacio de OANIX.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleThemeChange = () => setTheme(readSavedOanixTheme())
    window.addEventListener('oanix:theme-change', handleThemeChange)
    return () => window.removeEventListener('oanix:theme-change', handleThemeChange)
  }, [])

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  )
  const activeFolder = activeFolderId ? folderById.get(activeFolderId) ?? null : null

  const visibleNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')
    const filtered = notes.filter((note) => {
      if (viewMode === 'home' && activeFolderId && note.folderId !== activeFolderId) return false
      if (activeTagId && !note.tagIds.includes(activeTagId)) return false
      if (normalizedQuery && !note.title.toLocaleLowerCase('es').includes(normalizedQuery)) return false
      return true
    })

    return [...filtered].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  }, [notes, activeFolderId, activeTagId, query, viewMode])

  const mainStyle = activeFolder
    ? ({
        '--active-folder-cover': activeCover
          ? `linear-gradient(rgba(8, 8, 12, .28), rgba(8, 8, 12, .28)), url("${activeCover}") center / cover no-repeat`
          : folderSurfaceCss(activeFolder, 0.28),
        '--active-folder-accent': folderAccent(activeFolder),
      } as CSSProperties)
    : undefined

  function chooseTheme(next: OanixThemePreset['id']) {
    setTheme(applyOanixTheme(next))
  }

  function chooseAutoLock(next: AutoLockMinutes) {
    setAutoLockMinutes(saveAutoLockMinutes(next))
  }

  function focusSearch() {
    setViewMode('home')
    window.requestAnimationFrame(() => searchRef.current?.focus())
  }

  function commitOpenedEditor(next: OpenedEditor | null) {
    editorRef.current = next
    setEditor(next)
  }

  function mergeUpdatedNoteMetadata(updated: NoteV2Meta[]) {
    if (updated.length === 0) return
    const byId = new Map(updated.map((note) => [note.id, note]))
    setNotes((current) => current.map((note) => byId.get(note.id) ?? note))
  }

  async function openNote(noteId: string) {
    if (openingNote || saving || noteCardBusy) return
    setOpeningNote(true)
    setError('')
    try {
      const opened = await readRebuildNote(noteId)
      commitOpenedEditor({
        meta: opened.meta,
        text: opened.text,
      })
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'No se pudo abrir la nota.')
    } finally {
      setOpeningNote(false)
    }
  }

  async function createNote() {
    if (saving || noteCardBusy) return
    setError('')
    try {
      const folderId = activeFolderId
      const fallbackOrder = -Date.now()
      const nextOrder = notes.length > 0
        ? Math.min(...notes.map((note) => noteHomeOrder(note))) - 1
        : fallbackOrder
      const folderNotes = folderId
        ? notes.filter((note) => note.folderId === folderId)
        : []
      const nextFolderOrder = folderId
        ? folderNotes.length > 0
          ? Math.min(...folderNotes.map((note) => noteFolderOrder(note))) - 1
          : fallbackOrder
        : undefined
      const created = await createRebuildNote(folderId, nextOrder, nextFolderOrder)
      setNotes((current) => [created.meta, ...current])
      commitOpenedEditor({
        meta: created.meta,
        text: created.text,
      })
      setCreateKind(null)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la nota.')
    }
  }

  async function saveEditorSnapshot(snapshot: EditorSurfaceSnapshot): Promise<boolean> {
    if (!editorRef.current || blockingSaveRef.current) return false

    setError('')
    try {
      return await editorSaveCoordinator.run(async () => {
        const current = editorRef.current
        if (!current || blockingSaveRef.current) return false

        const updated = await saveRebuildNote(
          current.meta,
          current.text,
          snapshot.title,
          snapshot.text,
        )
        if (editorRef.current?.meta.id !== current.meta.id) return false

        const next: OpenedEditor = {
          meta: updated,
          text: snapshot.text,
        }
        commitOpenedEditor(next)
        setNotes((notes) => notes.map((note) => note.id === updated.id ? updated : note))
        return true
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la nota.')
      return false
    }
  }

  async function loadEditorBlocks(): Promise<EditorSurfaceBlock[]> {
    const noteId = editorRef.current?.meta.id
    if (!noteId) return []

    return editorSaveCoordinator.run(async () => {
      if (editorRef.current?.meta.id !== noteId) return []
      const blocks = await readRebuildBlocks(noteId)
      if (editorRef.current?.meta.id !== noteId) return []
      return blocks.map((block) => ({
        id: block.blockId,
        kind: block.kind,
        data: block.data,
      }))
    })
  }

  async function saveEditorBlocks(changes: EditorSurfaceBlockChangeSet): Promise<boolean> {
    const noteId = editorRef.current?.meta.id
    if (!noteId || blockingSaveRef.current) return false

    setError('')
    try {
      return await editorSaveCoordinator.run(async () => {
        const current = editorRef.current
        if (!current || current.meta.id !== noteId) return false

        const updated = await saveRebuildBlocks(current.meta, {
          upserts: changes.upserts?.map((block) => ({
            blockId: block.id,
            kind: block.kind,
            data: block.data,
          })),
          deletes: changes.deletes,
          order: changes.order,
        })
        if (updated === current.meta) return true
        if (editorRef.current?.meta.id !== noteId) return false

        commitOpenedEditor({ meta: updated, text: current.text })
        setNotes((notes) => notes.map((note) => note.id === updated.id ? updated : note))
        return true
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudieron guardar los bloques de la nota.')
      return false
    }
  }

  async function closeEditor(snapshot: EditorSurfaceSnapshot | null): Promise<boolean> {
    if (!editorRef.current || blockingSaveRef.current) return false

    blockingSaveRef.current = true
    setSaving(true)
    setError('')
    try {
      await editorSaveCoordinator.idle()

      if (!snapshot) {
        commitOpenedEditor(null)
        return true
      }

      return await editorSaveCoordinator.run(async () => {
        const current = editorRef.current
        if (!current) return false

        const updated = await saveRebuildNote(
          current.meta,
          current.text,
          snapshot.title,
          snapshot.text,
        )
        setNotes((notes) => notes.map((note) => note.id === updated.id ? updated : note))
        commitOpenedEditor(null)
        return true
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la nota.')
      return false
    } finally {
      blockingSaveRef.current = false
      setSaving(false)
    }
  }

  async function removeFolder(folderId: string) {
    const updatedNotes = await deleteRebuildFolder(folderId)
    mergeUpdatedNoteMetadata(updatedNotes)
    setFolders((current) => current.filter((folder) => folder.id !== folderId))
    if (activeFolderId === folderId) {
      setActiveFolderId(null)
      setActiveCover(null)
      setViewMode('home')
    }
  }

  async function removeTag(tagId: string) {
    const updatedNotes = await deleteRebuildTag(tagId)
    mergeUpdatedNoteMetadata(updatedNotes)
    setTags((current) => current.filter((tag) => tag.id !== tagId))
    if (activeTagId === tagId) setActiveTagId(null)
  }

  async function removeNote(note: NoteV2Meta) {
    if (openingNote || saving || noteCardBusy) return
    if (!window.confirm(`¿Eliminar la nota “${note.title}”?\n\nEsta acción eliminará la nota y su contenido.`)) return

    setError('')
    try {
      await deleteRebuildNote(note.id)
      setNotes((current) => current.filter((item) => item.id !== note.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la nota.')
    }
  }

  async function saveNoteCard(
    note: NoteV2Meta,
    input: RebuildNoteCardCustomization,
  ): Promise<boolean> {
    if (noteCardBusy || openingNote || saving) return false
    setNoteCardBusy(true)
    setError('')
    try {
      const updated = await saveRebuildNoteCard(note, input)
      mergeUpdatedNoteMetadata([updated])
      const currentEditor = editorRef.current
      if (currentEditor?.meta.id === updated.id) {
        commitOpenedEditor({ ...currentEditor, meta: updated })
      }
      return true
    } catch (customizeError) {
      setError(customizeError instanceof Error ? customizeError.message : 'No se pudo personalizar la nota.')
      return false
    } finally {
      setNoteCardBusy(false)
    }
  }

  async function moveNote(
    note: NoteV2Meta,
    previous: NoteV2Meta | null,
    next: NoteV2Meta | null,
  ) {
    if (
      noteCardBusy
      || openingNote
      || saving
      || viewMode !== 'home'
      || activeTagId !== null
      || query.trim().length > 0
    ) return

    const folderId = activeFolderId
    const scope: NoteOrderScope = folderId ? 'folder' : 'home'
    if (folderId && note.folderId !== folderId) return

    const nextOrder = orderForMovedNote(previous, next, scope)
    if (nextOrder === null || nextOrder === noteOrderForScope(note, scope)) return

    const optimistic: NoteV2Meta = folderId
      ? { ...note, folderOrder: { folderId, order: nextOrder } }
      : { ...note, order: nextOrder }
    setNoteCardBusy(true)
    setError('')
    setNotes((current) => current.map((item) => item.id === note.id ? optimistic : item))

    try {
      const updated = folderId
        ? await saveRebuildNoteFolderOrder(note, folderId, nextOrder)
        : await saveRebuildNoteOrder(note, nextOrder)
      mergeUpdatedNoteMetadata([updated])
    } catch (moveError) {
      setNotes((current) => current.map((item) => item.id === note.id ? note : item))
      setError(moveError instanceof Error ? moveError.message : 'No se pudo mover la nota.')
    } finally {
      setNoteCardBusy(false)
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (createKind !== 'folder' && createKind !== 'tag') return

    setError('')
    try {
      if (createKind === 'folder') {
        const folder = await createRebuildFolder(createName)
        setFolders((current) => [...current, folder])
        setActiveFolderId(folder.id)
        setViewMode('home')
      } else {
        const tag = await createRebuildTag(createName)
        setTags((current) => [...current, tag])
      }
      setCreateName('')
      setCreateKind(null)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el elemento.')
    }
  }

  const shellClass = `rebuild-shell${editor ? ' rebuild-shell--open' : ''}`

  if (loading) {
    return (
      <main className="rebuild-boot" aria-live="polite">
        <span className="rebuild-spinner" aria-hidden="true" />
        <strong>Preparando tu espacio</strong>
        <p>Abriendo el almacenamiento cifrado nuevo de OANIX.</p>
      </main>
    )
  }

  return (
    <main className={shellClass}>
      <section className="rebuild-main" style={mainStyle}>
        <header className="rebuild-topbar">
          <button
            className="rebuild-icon-button"
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir carpetas y etiquetas"
          >
            ☰
          </button>

          <div className="rebuild-brand">
            <img
              className="rebuild-brand__badge"
              src={logoSrc}
              alt=""
              aria-hidden="true"
              style={{ objectFit: 'contain' }}
            />
            <span>OANIX</span>
          </div>

          <input
            ref={searchRef}
            className="rebuild-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar notas…"
            aria-label="Buscar notas"
          />

          <div className="rebuild-topbar__spacer" />

          <button className="rebuild-icon-button" type="button" onClick={focusSearch} aria-label="Buscar">
            <OanixIcon name="search" />
          </button>
          <button
            className="rebuild-icon-button"
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Cuenta de OANIX"
          >
            <OanixIcon name="user" />
          </button>
        </header>

        {viewMode === 'home' ? (
          <nav className="rebuild-folders" aria-label="Carpetas">
            <button
              type="button"
              className={`rebuild-folder-tab${activeFolderId === null ? ' is-active' : ''}`}
              onClick={() => setActiveFolderId(null)}
            >
              <span className="rebuild-folder-tab__icon">✨</span>
              Todas <small>{notes.length}</small>
            </button>
            {folders.map((folder) => {
              const count = notes.filter((note) => note.folderId === folder.id).length
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={`rebuild-folder-tab${activeFolderId === folder.id ? ' is-active' : ''}`}
                  style={folderStyle(folder)}
                  onClick={() => setActiveFolderId(folder.id)}
                >
                  <span className="rebuild-folder-tab__icon">{folder.icon}</span>
                  {folder.name} <small>{count}</small>
                </button>
              )
            })}
          </nav>
        ) : (
          <div className="rebuild-mode-strip">
            <span>🕘 Recientes · últimas notas modificadas</span>
          </div>
        )}

        <div className="rebuild-tags" aria-label="Etiquetas">
          <button
            type="button"
            className={`rebuild-tag${activeTagId === null ? ' is-active' : ''}`}
            onClick={() => setActiveTagId(null)}
          >
            Todas
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`rebuild-tag${activeTagId === tag.id ? ' is-active' : ''}`}
              onClick={() => setActiveTagId((current) => current === tag.id ? null : tag.id)}
            >
              <i style={{ background: tag.color }} aria-hidden="true" />
              {tag.name}
            </button>
          ))}
        </div>

        <section className="rebuild-notes" aria-label="Notas">
          {error && <div className="rebuild-error" role="alert">{error}</div>}
          {visibleNotes.length === 0 ? (
            <div className="rebuild-empty">
              <strong>{query ? 'No encontramos notas' : 'Este espacio está listo'}</strong>
              <p>{query ? 'Prueba con otra búsqueda.' : 'Crea una nota con el botón + para empezar.'}</p>
            </div>
          ) : (
            <NoteListSection
              notes={visibleNotes}
              folderById={folderById}
              orderMode={
                viewMode === 'home'
                && activeTagId === null
                && query.trim().length === 0
                  ? activeFolderId === null ? 'home' : 'folder'
                  : null
              }
              onOpen={(noteId) => void openNote(noteId)}
              onDelete={(note) => void removeNote(note)}
              onCustomize={setCustomizingNote}
              onMove={(note, previous, next) => void moveNote(note, previous, next)}
              formatTime={formatNoteTime}
            />
          )}
        </section>

        <nav className="rebuild-bottom-nav" aria-label="Navegación principal">
          <button
            type="button"
            className={viewMode === 'home' && !query ? 'is-active' : ''}
            onClick={() => {
              setViewMode('home')
              setQuery('')
              setActiveTagId(null)
            }}
          >
            <span>🏠</span>Inicio
          </button>
          <button type="button" className={query ? 'is-active' : ''} onClick={focusSearch}>
            <span>🔍</span>Buscar
          </button>
          <button
            type="button"
            className="rebuild-fab"
            onClick={() => setCreateKind('chooser')}
            aria-label="Crear"
          >
            ＋
          </button>
          <button
            type="button"
            className={viewMode === 'recents' ? 'is-active' : ''}
            onClick={() => {
              setViewMode('recents')
              setActiveFolderId(null)
            }}
          >
            <span>🕘</span>Recientes
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            <span>⚙️</span>Ajustes
          </button>
        </nav>
      </section>

      <WorkspaceHomeController
        drawerOpen={drawerOpen}
        folders={folders}
        tags={tags}
        activeFolderId={activeFolderId}
        activeTagId={activeTagId}
        onCloseDrawer={() => setDrawerOpen(false)}
        onCreate={() => setCreateKind('chooser')}
        onSelectAllFolders={() => {
          setActiveFolderId(null)
          setViewMode('home')
          setDrawerOpen(false)
        }}
        onSelectFolder={(folderId) => {
          setActiveFolderId(folderId)
          setViewMode('home')
          setDrawerOpen(false)
        }}
        onSelectTag={(tagId) => {
          setActiveTagId((current) => current === tagId ? null : tagId)
          setDrawerOpen(false)
        }}
        onFoldersChange={setFolders}
        onTagsChange={setTags}
        onDeleteFolder={removeFolder}
        onDeleteTag={removeTag}
        onActiveCoverChange={setActiveCover}
        onError={setError}
      />

      {editor && (
        <EditorSurface
          key={editor.meta.id}
          noteId={editor.meta.id}
          initialTitle={editor.meta.title}
          initialText={editor.text}
          saving={saving}
          error={error}
          onRequestSave={saveEditorSnapshot}
          onRequestClose={closeEditor}
          loadBlocks={loadEditorBlocks}
          onRequestBlockSave={saveEditorBlocks}
        />
      )}

      {createKind && (
        <div className="rebuild-modal-host" role="presentation">
          <button
            className="rebuild-modal-backdrop"
            type="button"
            onClick={() => {
              setCreateKind(null)
              setCreateName('')
            }}
            data-oanix-back-close="true"
            aria-label="Cerrar"
          />
          <section className="rebuild-modal" role="dialog" aria-modal="true" aria-label="Crear">
            {createKind === 'chooser' ? (
              <>
                <header>
                  <div>
                    <small>NUEVO</small>
                    <strong>¿Qué quieres crear?</strong>
                  </div>
                  <button type="button" onClick={() => setCreateKind(null)} aria-label="Cerrar">×</button>
                </header>
                <div className="rebuild-create-options">
                  <button type="button" onClick={() => void createNote()}>
                    <span>📝</span><strong>Nueva nota</strong><small>Texto cifrado localmente</small>
                  </button>
                  <button type="button" onClick={() => setCreateKind('folder')}>
                    <span>📁</span><strong>Nueva carpeta</strong><small>Con degradado automático</small>
                  </button>
                  <button type="button" onClick={() => setCreateKind('tag')}>
                    <span>🏷️</span><strong>Nueva etiqueta</strong><small>Organiza tus notas</small>
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={(event) => void submitCreate(event)}>
                <header>
                  <div>
                    <small>{createKind === 'folder' ? 'CARPETA' : 'ETIQUETA'}</small>
                    <strong>{createKind === 'folder' ? 'Nueva carpeta' : 'Nueva etiqueta'}</strong>
                  </div>
                  <button type="button" onClick={() => setCreateKind(null)} aria-label="Cerrar">×</button>
                </header>
                <label>
                  <span>Nombre</span>
                  <input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    autoFocus
                    maxLength={createKind === 'folder' ? 60 : 40}
                  />
                </label>
                <footer>
                  <button type="button" onClick={() => setCreateKind('chooser')}>Volver</button>
                  <button type="submit">Crear</button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}

      <NoteCardCustomizationDialog
        note={customizingNote}
        busy={noteCardBusy}
        onClose={() => {
          if (!noteCardBusy) setCustomizingNote(null)
        }}
        onSave={saveNoteCard}
      />

      {settingsOpen && (
        <div className="rebuild-modal-host" role="presentation">
          <button
            className="rebuild-modal-backdrop"
            type="button"
            onClick={() => setSettingsOpen(false)}
            data-oanix-back-close="true"
            aria-label="Cerrar ajustes"
          />
          <section className="rebuild-modal" role="dialog" aria-modal="true" aria-label="Ajustes">
            <header>
              <div><small>OANIX</small><strong>Ajustes</strong></div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar">×</button>
            </header>
            <div className="rebuild-settings">
              <strong>Apariencia</strong>
              <div>
                <button
                  type="button"
                  className={theme === 'classic-day' ? 'is-active' : ''}
                  onClick={() => chooseTheme('classic-day')}
                >
                  ☀️ Día
                </button>
                <button
                  type="button"
                  className={theme === 'classic-night' ? 'is-active' : ''}
                  onClick={() => chooseTheme('classic-night')}
                >
                  🌙 Noche
                </button>
              </div>

              <strong>Bloqueo automático</strong>
              <div className="rebuild-auto-lock" role="radiogroup" aria-label="Tiempo de bloqueo automático">
                {AUTO_LOCK_OPTIONS.map((option) => (
                  <button
                    key={option.minutes}
                    type="button"
                    role="radio"
                    aria-checked={autoLockMinutes === option.minutes}
                    className={autoLockMinutes === option.minutes ? 'is-active' : ''}
                    onClick={() => chooseAutoLock(option.minutes)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button className="rebuild-lock-action" type="button" onClick={onLock}>
                <OanixIcon name="lock" /> Bloquear OANIX
              </button>
            </div>
          </section>
        </div>
      )}

      {(showSavingOverlay || showOpeningOverlay) && (
        <section className="rebuild-progress" role="status" aria-live="polite">
          <span className="rebuild-spinner" aria-hidden="true" />
          <strong>{showSavingOverlay ? 'Guardando cambios…' : 'Abriendo nota…'}</strong>
          <p>{showSavingOverlay ? 'Cifrando y confirmando el guardado local.' : 'Descifrando únicamente esta nota.'}</p>
          <span className="rebuild-progress__bar" aria-hidden="true"><i /></span>
        </section>
      )}

      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
    </main>
  )
}
