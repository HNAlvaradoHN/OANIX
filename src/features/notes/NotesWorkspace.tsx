import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { deleteEncryptedImage } from '../images/imageService'
import { createFolder, deleteFolder, loadFolders, renameFolder, reorderFolder } from '../folders/folderService'
import type { FolderRecord } from '../folders/folderTypes'
import { storageSaveErrorMessage } from '../../storage/local/storageErrors'
import { usesSinglePaneLayout } from '../../shared/responsiveLayout'
import { ImageNoteEditor } from '../images/ImageNoteEditor'
import { createEmptyNote, deleteNote, loadNotes, moveNoteToFolder, renameNote, replaceNoteContent } from './noteService'
import { prepareDailyEntriesForEditing } from './dailyEntries'
import { noteBlocksToPlainText, type NoteRecord, type StoredNoteBlock } from './noteTypes'
import './notes.css'

interface NotesWorkspaceProps {
  onLock: () => void
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface PendingContent {
  noteId: string
  blocks: StoredNoteBlock[]
}

interface OanixHistoryState {
  oanixView?: 'list' | 'note'
  noteId?: string
}

function mobileSinglePane(): boolean {
  const width = window.visualViewport?.width ?? window.innerWidth
  return usesSinglePaneLayout(width)
}

function currentHistoryState(): Record<string, unknown> {
  const value = window.history.state
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function formatNoteTime(isoDate: string): string {
  const date = new Date(isoDate)
  const today = new Date()

  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('es-HN', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function noteInitial(title: string): string {
  const first = title.trim().charAt(0)
  return first ? first.toUpperCase() : 'N'
}

function notePreview(note: NoteRecord): string {
  return noteBlocksToPlainText(note.content.blocks) || 'Nota vacía · empieza a escribir'
}

function saveStateLabel(saveState: SaveState, savingTitle: boolean): string {
  if (savingTitle) return 'Guardando título…'
  if (saveState === 'dirty') return 'Cambios pendientes…'
  if (saveState === 'saving') return 'Guardando cifrado…'
  if (saveState === 'saved') return 'Guardado · cifrado local'
  if (saveState === 'error') return 'No se pudo guardar'
  return 'Cifrada en este dispositivo'
}

export function NotesWorkspace({ onLock }: NotesWorkspaceProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all')
  const [folderManagerOpen, setFolderManagerOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [folderBusyId, setFolderBusyId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
  const [folderScrollHint, setFolderScrollHint] = useState<'left' | 'right' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [noteMenuId, setNoteMenuId] = useState<string | null>(null)
  const [noteMenuDirection, setNoteMenuDirection] = useState<'down' | 'up'>('down')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [activeNoteMenuOpen, setActiveNoteMenuOpen] = useState(false)
  const [noteInfoOpen, setNoteInfoOpen] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  const folderTabsRef = useRef<HTMLElement | null>(null)
  const pendingContentRef = useRef<PendingContent | null>(null)
  const activeSaveRef = useRef<Promise<boolean> | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const notesRef = useRef<NoteRecord[]>([])
  const historyBackAlreadySavedRef = useRef(false)
  const pendingImageDeletesRef = useRef(new Set<string>())

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  )
  const deletingSelected = !!selectedNote && deletingId === selectedNote.id
  const visibleNotes = useMemo(
    () => activeFolderId === 'all'
      ? notes
      : notes.filter((note) => note.folderId === activeFolderId),
    [notes, activeFolderId],
  )
  const moveTargetNote = useMemo(
    () => notes.find((note) => note.id === moveNoteId) ?? null,
    [notes, moveNoteId],
  )

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    if (!mobileSinglePane()) return

    const state = currentHistoryState() as OanixHistoryState
    if (state.oanixView !== 'note') {
      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')
    }

    function closeNoteView() {
      selectedIdRef.current = null
      setSelectedId(null)
      setSaveState('idle')
    }

    function handlePopState(event: PopStateEvent) {
      if (!mobileSinglePane()) return
      const nextState = (event.state ?? {}) as OanixHistoryState

      if (nextState.oanixView === 'note' && nextState.noteId) {
        if (notesRef.current.some((note) => note.id === nextState.noteId)) {
          selectedIdRef.current = nextState.noteId
          setSelectedId(nextState.noteId)
          setSaveState('idle')
        }
        return
      }

      const openId = selectedIdRef.current
      if (!openId) return

      if (historyBackAlreadySavedRef.current) {
        historyBackAlreadySavedRef.current = false
        closeNoteView()
        return
      }

      void (async () => {
        if (!(await flushPendingContent())) {
          window.history.pushState(
            { ...currentHistoryState(), oanixView: 'note', noteId: openId },
            '',
          )
          return
        }
        await finalizeRemovedImages()
        closeNoteView()
      })()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let active = true

    void Promise.all([loadNotes(), loadFolders()])
      .then(([storedNotes, storedFolders]) => {
        if (!active) return
        setNotes(storedNotes)
        setFolders(storedFolders)
      })
      .catch(() => {
        if (!active) return
        setError('No se pudieron cargar las notas y carpetas cifradas de este dispositivo.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setDraftTitle(selectedNote?.title ?? '')
  }, [selectedNote?.id, selectedNote?.title])

  useEffect(() => {
    const tabs = folderTabsRef.current
    if (!tabs) return

    function updateHint() {
      const overflow = tabs.scrollWidth > tabs.clientWidth + 4
      if (!overflow) {
        setFolderScrollHint(null)
        return
      }
      const hasRight = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4
      setFolderScrollHint(hasRight ? 'right' : tabs.scrollLeft > 4 ? 'left' : null)
    }

    const frame = window.requestAnimationFrame(updateHint)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateHint)
    observer?.observe(tabs)
    window.addEventListener('resize', updateHint)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', updateHint)
    }
  }, [folders.length])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    function closeNoteMenu(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && target.closest('[data-note-menu-root="true"]')) return
      setNoteMenuId(null)
      setWorkspaceMenuOpen(false)
      setActiveNoteMenuOpen(false)
    }

    function closeNoteMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNoteMenuId(null)
        setWorkspaceMenuOpen(false)
        setActiveNoteMenuOpen(false)
        setNoteInfoOpen(false)
        setMoveNoteId(null)
        setFolderManagerOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeNoteMenu)
    document.addEventListener('keydown', closeNoteMenuWithKeyboard)

    return () => {
      document.removeEventListener('pointerdown', closeNoteMenu)
      document.removeEventListener('keydown', closeNoteMenuWithKeyboard)
    }
  }, [])

  function replaceNoteInState(updated: NoteRecord) {
    setNotes((current) =>
      current
        .map((note) => (note.id === updated.id ? updated : note))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    )
  }

  function folderName(folderId: string | null | undefined): string {
    if (!folderId) return 'Sin carpeta'
    return folders.find((folder) => folder.id === folderId)?.name ?? 'Carpeta no disponible'
  }

  function clearSaveTimer() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }

  async function flushPendingContent(): Promise<boolean> {
    clearSaveTimer()
    const pending = pendingContentRef.current

    if (!pending) {
      return activeSaveRef.current ? await activeSaveRef.current : true
    }

    pendingContentRef.current = null
    if (selectedIdRef.current === pending.noteId) setSaveState('saving')
    setError('')

    const savePromise = (async () => {
      try {
        const updated = await replaceNoteContent(pending.noteId, pending.blocks)
        replaceNoteInState(updated)
        setError('')

        if (selectedIdRef.current === pending.noteId) {
          setSaveState(pendingContentRef.current ? 'dirty' : 'saved')
        }
        return true
      } catch (saveError) {
        console.error('OANIX encrypted note save failed', saveError)
        if (!pendingContentRef.current) pendingContentRef.current = pending
        if (selectedIdRef.current === pending.noteId) setSaveState('error')
        setError(storageSaveErrorMessage(saveError))
        return false
      }
    })()

    activeSaveRef.current = savePromise
    const result = await savePromise
    if (activeSaveRef.current === savePromise) activeSaveRef.current = null
    return result
  }

  function handleContentChange(blocks: StoredNoteBlock[]) {
    if (!selectedNote) return

    pendingContentRef.current = { noteId: selectedNote.id, blocks }
    setSaveState('dirty')
    setError('')
    clearSaveTimer()
    saveTimerRef.current = window.setTimeout(() => {
      void flushPendingContent()
    }, 550)
  }

  async function handleRemovedImage(imageId: string): Promise<void> {
    pendingImageDeletesRef.current.add(imageId)
  }

  function handleRestoredImage(imageId: string) {
    pendingImageDeletesRef.current.delete(imageId)
  }

  async function finalizeRemovedImages(): Promise<void> {
    const imageIds = [...pendingImageDeletesRef.current]
    pendingImageDeletesRef.current.clear()

    await Promise.allSettled(imageIds.map((imageId) => deleteEncryptedImage(imageId)))
  }

  async function handleDeleteNote(targetNote: NoteRecord) {
    if (deletingId) return

    const confirmed = window.confirm(
      `¿Eliminar esta nota de forma permanente?\n\n“${targetNote.title}” se eliminará de este dispositivo junto con sus imágenes asociadas. Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    const noteId = targetNote.id
    const deletingSelectedNote = selectedIdRef.current === noteId
    const deletedIndex = notes.findIndex((note) => note.id === noteId)
    const remainingBeforeStateUpdate = notes.filter((note) => note.id !== noteId)
    const nextIndex = remainingBeforeStateUpdate.length === 0
      ? -1
      : Math.min(Math.max(deletedIndex, 0), remainingBeforeStateUpdate.length - 1)
    const nextId = nextIndex >= 0 ? remainingBeforeStateUpdate[nextIndex].id : null

    setDeletingId(noteId)
    setNoteMenuId(null)
    setError('')

    try {
      const deleted = await deleteNote(noteId)
      const imageIds = deleted.content.blocks.flatMap((block) =>
        block.type === 'image' ? [block.imageId] : [],
      )

      await Promise.allSettled(imageIds.map((imageId) => deleteEncryptedImage(imageId)))

      setNotes((current) => current.filter((note) => note.id !== noteId))

      if (deletingSelectedNote) {
        clearSaveTimer()
        pendingContentRef.current = null
        selectedIdRef.current = nextId
        setSelectedId(nextId)
        setSaveState('idle')
      }

      setError('')
    } catch {
      if (deletingSelectedNote) setSaveState('error')
      setError('No se pudo eliminar la nota cifrada.')
    } finally {
      setDeletingId(null)
    }
  }

  function pushMobileNoteHistory(noteId: string) {
    if (!mobileSinglePane()) return
    window.history.pushState(
      { ...currentHistoryState(), oanixView: 'note', noteId },
      '',
    )
  }

  async function handleSelectFolder(folderId: string | 'all') {
    if (folderId === activeFolderId) return
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    setActiveFolderId(folderId)
    selectedIdRef.current = null
    setSelectedId(null)
    setSaveState('idle')
    setNoteMenuId(null)
    setActiveNoteMenuOpen(false)
    setNoteInfoOpen(false)

    if (mobileSinglePane()) {
      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')
    }
  }

  async function handleCreateNote() {
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    setCreating(true)
    setError('')

    try {
      const note = await createEmptyNote(activeFolderId === 'all' ? null : activeFolderId)
      setNotes((current) => [note, ...current])
      selectedIdRef.current = note.id
      setSelectedId(note.id)
      pushMobileNoteHistory(note.id)
      setSaveState('idle')
    } catch {
      setError('No se pudo crear la nota cifrada.')
    } finally {
      setCreating(false)
    }
  }

  function folderNameExists(name: string, exceptId?: string): boolean {
    const candidate = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    return folders.some((folder) =>
      folder.id !== exceptId && folder.name.toLocaleLowerCase() === candidate,
    )
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim().replace(/\s+/g, ' ')
    if (!name) {
      setError('Escribe un nombre para la carpeta.')
      return
    }
    if (folderNameExists(name)) {
      setError('Ya existe una carpeta con ese nombre.')
      return
    }

    setCreatingFolder(true)
    setError('')
    try {
      const folder = await createFolder(name)
      setFolders((current) => [...current, folder])
      setNewFolderName('')
      await handleSelectFolder(folder.id)
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : 'No se pudo crear la carpeta cifrada.')
    } finally {
      setCreatingFolder(false)
    }
  }

  function beginFolderRename(folder: FolderRecord) {
    setEditingFolderId(folder.id)
    setEditingFolderName(folder.name)
    setError('')
  }

  async function handleRenameFolder(folder: FolderRecord) {
    const name = editingFolderName.trim().replace(/\s+/g, ' ')
    if (!name) {
      setError('El nombre de la carpeta no puede estar vacío.')
      return
    }
    if (folderNameExists(name, folder.id)) {
      setError('Ya existe una carpeta con ese nombre.')
      return
    }

    setFolderBusyId(folder.id)
    setError('')
    try {
      const updated = await renameFolder(folder.id, name)
      setFolders((current) => current.map((item) => item.id === updated.id ? updated : item))
      setEditingFolderId(null)
      setEditingFolderName('')
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : 'No se pudo renombrar la carpeta.')
    } finally {
      setFolderBusyId(null)
    }
  }

  async function handleReorderFolder(folder: FolderRecord, direction: 'up' | 'down') {
    setFolderBusyId(folder.id)
    setError('')
    try {
      const reordered = await reorderFolder(folder.id, direction)
      setFolders(reordered)
    } catch {
      setError('No se pudo guardar el nuevo orden de las carpetas.')
    } finally {
      setFolderBusyId(null)
    }
  }

  async function handleMoveNote(targetNote: NoteRecord, folderId: string | null) {
    if (targetNote.id === selectedIdRef.current && !(await flushPendingContent())) return

    setFolderBusyId(targetNote.id)
    setError('')
    try {
      const updated = await moveNoteToFolder(targetNote.id, folderId)
      replaceNoteInState(updated)
      setMoveNoteId(null)
      setNoteMenuId(null)
      setActiveNoteMenuOpen(false)
    } catch {
      setError('No se pudo mover la nota a la carpeta seleccionada.')
    } finally {
      setFolderBusyId(null)
    }
  }

  async function handleDeleteFolder(folder: FolderRecord) {
    const affected = notes.filter((note) => note.folderId === folder.id)
    const detail = affected.length === 0
      ? 'La carpeta se eliminará. No contiene notas.'
      : `La carpeta se eliminará y ${affected.length} nota${affected.length === 1 ? '' : 's'} volverá${affected.length === 1 ? '' : 'n'} a “Sin carpeta”.`
    if (!window.confirm(`¿Eliminar la carpeta “${folder.name}”?\n\n${detail}\n\nLas notas NO se eliminarán.`)) return

    if (!(await flushPendingContent())) return
    setFolderBusyId(folder.id)
    setError('')
    try {
      const movedNotes = await Promise.all(affected.map((note) => moveNoteToFolder(note.id, null)))
      if (movedNotes.length > 0) {
        const movedById = new Map(movedNotes.map((note) => [note.id, note]))
        setNotes((current) => current.map((note) => movedById.get(note.id) ?? note))
      }
      await deleteFolder(folder.id)
      setFolders((current) => current.filter((item) => item.id !== folder.id))
      if (activeFolderId === folder.id) await handleSelectFolder('all')
      if (editingFolderId === folder.id) {
        setEditingFolderId(null)
        setEditingFolderName('')
      }
    } catch {
      setError('No se pudo completar la eliminación de la carpeta.')
    } finally {
      setFolderBusyId(null)
    }
  }

  async function persistTitle() {
    if (!selectedNote || savingTitle) return

    if (draftTitle.trim() === selectedNote.title) {
      setDraftTitle(selectedNote.title)
      return
    }

    if (!(await flushPendingContent())) return

    setSavingTitle(true)
    setError('')

    try {
      const updated = await renameNote(selectedNote.id, draftTitle)
      replaceNoteInState(updated)
      setDraftTitle(updated.title)
      setSaveState('saved')
    } catch {
      setDraftTitle(selectedNote.title)
      setSaveState('error')
      setError('No se pudo guardar el nuevo título de la nota.')
    } finally {
      setSavingTitle(false)
    }
  }

  async function handleSelectNote(noteId: string) {
    setNoteMenuId(null)
    setActiveNoteMenuOpen(false)
    if (noteId === selectedId) return
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    selectedIdRef.current = noteId
    setSelectedId(noteId)
    pushMobileNoteHistory(noteId)
    setSaveState('idle')
  }

  async function handleBack() {
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    const state = (window.history.state ?? {}) as OanixHistoryState
    if (mobileSinglePane() && state.oanixView === 'note') {
      historyBackAlreadySavedRef.current = true
      window.history.back()
      return
    }

    selectedIdRef.current = null
    setSelectedId(null)
    setSaveState('idle')
  }

  async function handleLockWorkspace() {
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()
    onLock()
  }

  function handleTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    }
  }

  function toggleNoteMenu(noteId: string, event: ReactMouseEvent<HTMLButtonElement>) {
    if (noteMenuId === noteId) {
      setNoteMenuId(null)
      return
    }

    const buttonRect = event.currentTarget.getBoundingClientRect()
    const listRect = event.currentTarget.closest('.notes-list')?.getBoundingClientRect()
    const topBoundary = listRect?.top ?? 0
    const bottomBoundary = listRect?.bottom ?? window.innerHeight
    const estimatedMenuHeight = 108
    const spaceBelow = bottomBoundary - buttonRect.bottom
    const spaceAbove = buttonRect.top - topBoundary

    setNoteMenuDirection(
      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'up' : 'down',
    )
    setNoteMenuId(noteId)
  }

  return (
    <main className={`notes-shell${selectedNote ? ' notes-shell--open' : ''}`}>
      <aside className="notes-sidebar" aria-label="Lista de notas">
        <header className="notes-header">
          <div className="notes-brand">
            <div className="notes-brand__mark" aria-hidden="true">O</div>
            <div>
              <strong>OANIX</strong>
              <span>Notas privadas</span>
            </div>
          </div>
          <div className="notes-header__actions" data-note-menu-root="true">
            <button
              className="icon-button"
              type="button"
              onClick={() => void handleLockWorkspace()}
              aria-label="Bloquear OANIX"
              title="Bloquear OANIX"
            >
              🔒
            </button>
            <div className="workspace-menu-wrap">
              <button
                className="icon-button"
                type="button"
                aria-label="Menú de OANIX"
                aria-haspopup="menu"
                aria-expanded={workspaceMenuOpen}
                title="Menú de OANIX"
                onClick={() => setWorkspaceMenuOpen((open) => !open)}
              >
                ⋮
              </button>
              {workspaceMenuOpen && (
                <div className="workspace-menu" role="menu" aria-label="Acciones de OANIX">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setWorkspaceMenuOpen(false)
                      setFolderManagerOpen(true)
                    }}
                  >
                    <span aria-hidden="true">📁</span> Administrar carpetas
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setWorkspaceMenuOpen(false)
                      window.alert('OANIX V1 · bóveda local cifrada · offline-first')
                    }}
                  >
                    <span aria-hidden="true">ⓘ</span> Acerca de OANIX
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`notes-tabs-shell${folderScrollHint ? ` notes-tabs-shell--hint-${folderScrollHint}` : ''}`}>
          <nav
            className="notes-tabs"
            aria-label="Carpetas de notas"
            ref={folderTabsRef}
            onScroll={() => {
              const tabs = folderTabsRef.current
              if (!tabs) return
              const hasRight = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4
              setFolderScrollHint(hasRight ? 'right' : tabs.scrollLeft > 4 ? 'left' : null)
            }}
          >
            <button
              className={`notes-tab${activeFolderId === 'all' ? ' notes-tab--active' : ''}`}
              type="button"
              aria-current={activeFolderId === 'all' ? 'page' : undefined}
              onClick={() => void handleSelectFolder('all')}
            >
              Todas
            </button>
            {folders.map((folder) => (
              <button
                className={`notes-tab${activeFolderId === folder.id ? ' notes-tab--active' : ''}`}
                type="button"
                key={folder.id}
                aria-current={activeFolderId === folder.id ? 'page' : undefined}
                title={folder.name}
                onClick={() => void handleSelectFolder(folder.id)}
              >
                {folder.name}
              </button>
            ))}
            <button
              className="notes-tab notes-tab--add"
              type="button"
              aria-label="Crear o administrar carpetas"
              title="Carpetas"
              onClick={() => setFolderManagerOpen(true)}
            >
              ＋
            </button>
          </nav>
          {folderScrollHint && (
            <span className="notes-tabs-scroll-hint" aria-hidden="true">
              {folderScrollHint === 'right' ? 'Desliza →' : '← Desliza'}
            </span>
          )}
        </div>

        {error && <p className="notes-error" role="alert">{error}</p>}

        <div className="notes-list">
          {loading ? (
            <div className="notes-empty">
              <strong>Cargando notas…</strong>
              <p>Descifrando la lista local.</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty__icon" aria-hidden="true">✎</div>
              <strong>Aún no hay notas</strong>
              <p>Crea la primera. Se guardará cifrada en este dispositivo.</p>
              <button className="empty-action" type="button" onClick={() => void handleCreateNote()} disabled={creating}>
                Crear primera nota
              </button>
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty__icon" aria-hidden="true">📁</div>
              <strong>Esta carpeta está vacía</strong>
              <p>Las notas que crees aquí quedarán organizadas en esta carpeta cifrada.</p>
              <button className="empty-action" type="button" onClick={() => void handleCreateNote()} disabled={creating}>
                Crear nota aquí
              </button>
            </div>
          ) : (
            visibleNotes.map((note) => (
              <div
                className={`note-row${selectedId === note.id ? ' note-row--selected' : ''}${noteMenuId === note.id ? ' note-row--menu-open' : ''}`}
                key={note.id}
                data-note-menu-root="true"
              >
                <button
                  className="note-row__open"
                  type="button"
                  onClick={() => void handleSelectNote(note.id)}
                >
                  <span className="note-row__avatar" aria-hidden="true">{noteInitial(note.title)}</span>
                  <span className="note-row__body">
                    <span className="note-row__topline">
                      <strong>{note.title}</strong>
                      <time dateTime={note.updatedAt}>{formatNoteTime(note.updatedAt)}</time>
                    </span>
                    <span className="note-row__preview">{notePreview(note)}</span>
                  </span>
                </button>

                <div className="note-row__menu-wrap">
                  <button
                    className="note-row__menu-button"
                    type="button"
                    aria-label={`Acciones de ${note.title}`}
                    aria-haspopup="menu"
                    aria-expanded={noteMenuId === note.id}
                    title="Acciones de la nota"
                    onClick={(event) => toggleNoteMenu(note.id, event)}
                  >
                    ⋮
                  </button>

                  {noteMenuId === note.id && (
                    <div
                      className={`note-row__menu${noteMenuDirection === 'up' ? ' note-row__menu--up' : ''}`}
                      role="menu"
                      aria-label={`Acciones de ${note.title}`}
                    >
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
                      <button
                        className="note-row__menu-danger"
                        type="button"
                        role="menuitem"
                        disabled={deletingId !== null}
                        onClick={() => void handleDeleteNote(note)}
                      >
                        {deletingId === note.id ? 'Eliminando…' : 'Eliminar nota'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <button
          className="notes-create-fab"
          type="button"
          onClick={() => void handleCreateNote()}
          disabled={creating}
          aria-label={creating ? 'Creando nota' : 'Crear nueva nota'}
          title="Nueva nota"
        >
          <span aria-hidden="true">＋</span>
          <span>{creating ? 'Creando…' : 'Nueva nota'}</span>
        </button>
      </aside>

      <section className="note-view" aria-label="Nota abierta">
        {selectedNote ? (
          <>
            <header className="note-view__header">
              <button
                className="back-button"
                type="button"
                onClick={() => void handleBack()}
                aria-label="Volver a la lista de notas"
                title="Volver"
              >
                ←
              </button>
              <div className="note-view__identity">
                <span className="note-view__avatar" aria-hidden="true">{noteInitial(selectedNote.title)}</span>
                <div>
                  <strong>{selectedNote.title}</strong>
                  <span className={saveState === 'error' ? 'save-status save-status--error' : 'save-status'}>
                    {deletingSelected ? 'Eliminando nota…' : saveStateLabel(saveState, savingTitle)}
                  </span>
                </div>
              </div>
              <div className="note-view__actions" data-note-menu-root="true">
                <button
                  className="note-view__menu-button"
                  type="button"
                  aria-label="Acciones de la nota"
                  aria-haspopup="menu"
                  aria-expanded={activeNoteMenuOpen}
                  title="Acciones de la nota"
                  onClick={() => setActiveNoteMenuOpen((open) => !open)}
                >
                  ⋮
                </button>
                {activeNoteMenuOpen && (
                  <div className="note-view__menu" role="menu" aria-label="Acciones de la nota">
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
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveNoteMenuOpen(false)
                        setNoteInfoOpen(true)
                      }}
                    >
                      <span aria-hidden="true">ⓘ</span> Información
                    </button>
                    <button
                      className="note-view__menu-danger"
                      type="button"
                      role="menuitem"
                      disabled={deletingId !== null}
                      onClick={() => {
                        setActiveNoteMenuOpen(false)
                        void handleDeleteNote(selectedNote)
                      }}
                    >
                      <span aria-hidden="true">🗑</span> {deletingSelected ? 'Eliminando…' : 'Eliminar nota'}
                    </button>
                  </div>
                )}
              </div>
            </header>

            <div className="note-canvas">
              <label className="note-title-field" htmlFor="note-title">
                <span>Título</span>
                <input
                  id="note-title"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => void persistTitle()}
                  onKeyDown={handleTitleKeyDown}
                  maxLength={160}
                  disabled={savingTitle}
                  aria-busy={savingTitle}
                />
              </label>

              {saveState === 'error' && error && (
                <div className="note-save-error" role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => void flushPendingContent()}>
                    Reintentar
                  </button>
                </div>
              )}

              <ImageNoteEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                initialBlocks={prepareDailyEntriesForEditing(selectedNote)}
                onChange={handleContentChange}
                onBlur={() => void flushPendingContent()}
                onRemoveImage={handleRemovedImage}
                onRestoreImage={handleRestoredImage}
              />
            </div>
          </>
        ) : (
          <div className="note-view__empty">
            <div className="note-view__empty-mark" aria-hidden="true">O</div>
            <strong>Selecciona una nota</strong>
            <p>La experiencia se organiza como una lista de conversaciones, pero cada elemento es una nota privada.</p>
          </div>
        )}

        {selectedNote && noteInfoOpen && (
          <div className="note-info-dialog" role="presentation" onClick={() => setNoteInfoOpen(false)}>
            <div
              className="note-info-dialog__panel"
              role="dialog"
              aria-modal="true"
              aria-label="Información de la nota"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="note-info-dialog__header">
                <strong>Información de la nota</strong>
                <button type="button" onClick={() => setNoteInfoOpen(false)} aria-label="Cerrar">×</button>
              </div>
              <dl>
                <div><dt>Título</dt><dd>{selectedNote.title}</dd></div>
                <div><dt>Creada</dt><dd>{new Date(selectedNote.createdAt).toLocaleString('es-HN')}</dd></div>
                <div><dt>Modificada</dt><dd>{new Date(selectedNote.updatedAt).toLocaleString('es-HN')}</dd></div>
                <div><dt>Carpeta</dt><dd>{folderName(selectedNote.folderId)}</dd></div>
                <div><dt>Bloques</dt><dd>{selectedNote.content.blocks.length}</dd></div>
                <div><dt>Protección</dt><dd>Cifrada localmente</dd></div>
              </dl>
            </div>
          </div>
        )}
      </section>

      {folderManagerOpen && (
        <div className="folder-dialog" role="presentation" onClick={() => setFolderManagerOpen(false)}>
          <div className="folder-dialog__panel" role="dialog" aria-modal="true" aria-label="Administrar carpetas" onClick={(event) => event.stopPropagation()}>
            <div className="folder-dialog__header">
              <div><strong>Carpetas</strong><span>Organización cifrada de tus notas</span></div>
              <button type="button" onClick={() => setFolderManagerOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="folder-create-row">
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void handleCreateFolder() }}
                maxLength={60}
                placeholder="Nueva carpeta"
                aria-label="Nombre de nueva carpeta"
              />
              <button type="button" onClick={() => void handleCreateFolder()} disabled={creatingFolder}>
                {creatingFolder ? 'Creando…' : 'Crear'}
              </button>
            </div>
            <div className="folder-list">
              {folders.length === 0 ? (
                <p className="folder-list__empty">Aún no has creado carpetas.</p>
              ) : folders.map((folder, folderIndex) => (
                <div className="folder-list__row" key={folder.id}>
                  {editingFolderId === folder.id ? (
                    <>
                      <input
                        className="folder-list__rename"
                        value={editingFolderName}
                        onChange={(event) => setEditingFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void handleRenameFolder(folder)
                          if (event.key === 'Escape') setEditingFolderId(null)
                        }}
                        maxLength={60}
                        autoFocus
                        aria-label={`Nuevo nombre para ${folder.name}`}
                      />
                      <div className="folder-list__actions">
                        <button type="button" onClick={() => void handleRenameFolder(folder)} disabled={folderBusyId === folder.id}>Guardar</button>
                        <button type="button" onClick={() => setEditingFolderId(null)}>Cancelar</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="folder-list__identity">
                        <span aria-hidden="true">📁</span>
                        <div><strong>{folder.name}</strong><small>{notes.filter((note) => note.folderId === folder.id).length} notas</small></div>
                      </div>
                      <div className="folder-list__actions">
                        <span className="folder-list__order" aria-label={`Orden de ${folder.name}`}>
                          <button type="button" title="Mover arriba" aria-label={`Mover ${folder.name} arriba`} onClick={() => void handleReorderFolder(folder, 'up')} disabled={folderBusyId === folder.id || folderIndex === 0}>↑</button>
                          <button type="button" title="Mover abajo" aria-label={`Mover ${folder.name} abajo`} onClick={() => void handleReorderFolder(folder, 'down')} disabled={folderBusyId === folder.id || folderIndex === folders.length - 1}>↓</button>
                        </span>
                        <button type="button" onClick={() => beginFolderRename(folder)}>Renombrar</button>
                        <button className="folder-list__delete" type="button" onClick={() => void handleDeleteFolder(folder)} disabled={folderBusyId === folder.id}>Eliminar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {moveTargetNote && (
        <div className="folder-dialog" role="presentation" onClick={() => setMoveNoteId(null)}>
          <div className="folder-dialog__panel folder-dialog__panel--move" role="dialog" aria-modal="true" aria-label="Mover nota a carpeta" onClick={(event) => event.stopPropagation()}>
            <div className="folder-dialog__header">
              <div><strong>Mover nota</strong><span>{moveTargetNote.title}</span></div>
              <button type="button" onClick={() => setMoveNoteId(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="folder-move-list">
              <button type="button" className={!moveTargetNote.folderId ? 'folder-move-option folder-move-option--active' : 'folder-move-option'} onClick={() => void handleMoveNote(moveTargetNote, null)} disabled={folderBusyId === moveTargetNote.id}>
                <span aria-hidden="true">📄</span><strong>Sin carpeta</strong>{!moveTargetNote.folderId && <span aria-hidden="true">✓</span>}
              </button>
              {folders.map((folder) => (
                <button type="button" key={folder.id} className={moveTargetNote.folderId === folder.id ? 'folder-move-option folder-move-option--active' : 'folder-move-option'} onClick={() => void handleMoveNote(moveTargetNote, folder.id)} disabled={folderBusyId === moveTargetNote.id}>
                  <span aria-hidden="true">📁</span><strong>{folder.name}</strong>{moveTargetNote.folderId === folder.id && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
