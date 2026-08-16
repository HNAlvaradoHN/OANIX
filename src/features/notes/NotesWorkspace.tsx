import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { deleteEncryptedImage } from '../images/imageService'
import { downloadEncryptedBackup } from '../backup/backupService'
import { createFolder, deleteFolder, loadFolders, renameFolder, reorderFolder } from '../folders/folderService'
import type { FolderRecord } from '../folders/folderTypes'
import { createTag, deleteTag, loadTags, renameTag } from '../tags/tagService'
import type { TagRecord } from '../tags/tagTypes'
import { storageSaveErrorMessage } from '../../storage/local/storageErrors'
import { usesSinglePaneLayout } from '../../shared/responsiveLayout'
import { ImageNoteEditor } from '../images/ImageNoteEditor'
import {
  createEmptyNote,
  deleteNote,
  loadNotes,
  moveNoteToFolder,
  persistNoteOrder,
  renameNote,
  replaceNoteContent,
  setNotePinned,
  setNoteTags,
} from './noteService'
import { searchItemsByLocalFields, type LocalSearchField } from '../search/localSearch'
import { prepareDailyEntriesForEditing } from './dailyEntries'
import { compareNotesForList, noteBlocksToPlainText, type NoteRecord, type StoredNoteBlock } from './noteTypes'
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

function richRunsText(runs: Array<{ text: string }>): string {
  return runs.map((run) => run.text).join('')
}

function noteLocalSearchFields(note: NoteRecord): LocalSearchField[] {
  const fields: LocalSearchField[] = [
    { key: `${note.id}:title`, label: 'Título', text: note.title },
  ]

  note.content.blocks.forEach((block, blockIndex) => {
    const key = `${note.id}:${block.id || blockIndex}`

    if (block.type === 'paragraph') {
      fields.push({ key, label: 'Texto', text: richRunsText(block.runs) })
      return
    }
    if (block.type === 'heading') {
      fields.push({ key, label: 'Encabezado', text: richRunsText(block.runs) })
      return
    }
    if (block.type === 'quote') {
      fields.push({ key, label: 'Cita', text: richRunsText(block.runs) })
      return
    }
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      block.items.forEach((item, itemIndex) => {
        fields.push({ key: `${key}:item:${itemIndex}`, label: 'Lista', text: richRunsText(item) })
      })
      return
    }
    if (block.type === 'checklist') {
      block.items.forEach((item, itemIndex) => {
        fields.push({ key: `${key}:check:${itemIndex}`, label: 'Checklist', text: item.text })
      })
      return
    }
    if (block.type === 'contact') {
      const contactFields = [
        ['Nombre de contacto', block.name],
        ['Teléfono de contacto', block.phone],
        ['Correo de contacto', block.email],
        ['Organización', block.organization],
        ['Notas de contacto', block.notes],
      ] as const
      contactFields.forEach(([label, value], fieldIndex) => {
        if (value.trim()) fields.push({ key: `${key}:contact:${fieldIndex}`, label, text: value })
      })
      return
    }
    if (block.type === 'dailyEntry') {
      if (block.title.trim()) fields.push({ key, label: 'Entrada del día', text: block.title })
      return
    }
    if (block.type === 'code') {
      fields.push({ key, label: `Código · ${block.language}`, text: block.text })
      return
    }
    if (block.type === 'image') {
      if (block.alt?.trim()) {
        fields.push({ key: `${key}:description`, label: 'Imagen · descripción', text: block.alt })
      }
      if (block.showName !== false && block.name.trim()) {
        fields.push({ key: `${key}:name`, label: 'Imagen · nombre', text: block.name })
      }
    }
  })

  return fields.filter((field) => field.text.trim().length > 0)
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
  const [tags, setTags] = useState<TagRecord[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all')
  const [activeTagId, setActiveTagId] = useState<string | 'all'>('all')
  const [folderManagerOpen, setFolderManagerOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [folderBusyId, setFolderBusyId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null)
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [orderingBusy, setOrderingBusy] = useState(false)
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
  const searchInputRef = useRef<HTMLInputElement | null>(null)
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
  const activeTag = useMemo(
    () => activeTagId === 'all' ? null : tags.find((tag) => tag.id === activeTagId) ?? null,
    [tags, activeTagId],
  )
  const hasSearchQuery = searchQuery.trim().length > 0
  const organizedNotes = useMemo(
    () => notes.filter((note) =>
      (activeFolderId === 'all' || note.folderId === activeFolderId) &&
      (activeTagId === 'all' || (note.tagIds ?? []).includes(activeTagId)),
    ),
    [notes, activeFolderId, activeTagId],
  )
  const searchResults = useMemo(
    () => hasSearchQuery
      ? searchItemsByLocalFields(notes, searchQuery, noteLocalSearchFields)
      : [],
    [notes, searchQuery, hasSearchQuery],
  )
  const searchResultByNoteId = useMemo(
    () => new Map(searchResults.map((result) => [result.item.id, result])),
    [searchResults],
  )
  const searchOccurrenceCount = useMemo(
    () => searchResults.reduce((total, result) => total + result.totalOccurrences, 0),
    [searchResults],
  )
  const visibleNotes = hasSearchQuery
    ? searchResults.map((result) => result.item)
    : organizedNotes
  const moveTargetNote = useMemo(
    () => notes.find((note) => note.id === moveNoteId) ?? null,
    [notes, moveNoteId],
  )
  const tagEditorNote = useMemo(
    () => notes.find((note) => note.id === tagEditorNoteId) ?? null,
    [notes, tagEditorNoteId],
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

    void Promise.all([loadNotes(), loadFolders(), loadTags()])
      .then(([storedNotes, storedFolders, storedTags]) => {
        if (!active) return
        setNotes(storedNotes)
        setFolders(storedFolders)
        setTags(storedTags)
      })
      .catch(() => {
        if (!active) return
        setError('No se pudieron cargar las notas, carpetas y etiquetas cifradas de este dispositivo.')
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
    const observedTabs = folderTabsRef.current
    if (!observedTabs) return

    function updateHint() {
      const tabs = folderTabsRef.current
      if (!tabs) return
      const overflow = tabs.scrollWidth > tabs.clientWidth + 4
      if (!overflow) {
        setFolderScrollEdges({ left: false, right: false })
        return
      }
      setFolderScrollEdges({
        left: tabs.scrollLeft > 4,
        right: tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4,
      })
    }

    const frame = window.requestAnimationFrame(updateHint)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateHint)
    observer?.observe(observedTabs)
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
        setTagFilterOpen(false)
        setTagManagerOpen(false)
        setTagEditorNoteId(null)
        setSearchOpen(false)
        setSearchQuery('')
        setReorderMode(false)
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
        .sort(compareNotesForList),
    )
  }

  function folderName(folderId: string | null | undefined): string {
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

  async function handleSelectTag(tagId: string | 'all') {
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
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    setCreating(true)
    setError('')

    try {
      const note = await createEmptyNote(
        activeFolderId === 'all' ? null : activeFolderId,
        activeTagId === 'all' ? [] : [activeTagId],
      )
      setNotes((current) => [...current, note].sort(compareNotesForList))
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

  async function handleTogglePinned(targetNote: NoteRecord) {
    if (targetNote.id === selectedIdRef.current && !(await flushPendingContent())) return

    setNoteMenuId(null)
    setActiveNoteMenuOpen(false)
    setError('')
    try {
      const updated = await setNotePinned(targetNote.id, targetNote.pinned !== true)
      replaceNoteInState(updated)
      if (updated.id === selectedIdRef.current) setSaveState('saved')
    } catch {
      setError('No se pudo cambiar el estado fijado de la nota.')
    }
  }

  function noteOrderPosition(targetNote: NoteRecord) {
    const pinned = targetNote.pinned === true
    const group = visibleNotes.filter((note) => (note.pinned === true) === pinned)
    const index = group.findIndex((note) => note.id === targetNote.id)
    return {
      canMoveUp: index > 0,
      canMoveDown: index >= 0 && index < group.length - 1,
      group,
      index,
    }
  }

  async function handleMoveNoteOrder(targetNote: NoteRecord, direction: 'up' | 'down') {
    if (orderingBusy || hasSearchQuery) return

    const position = noteOrderPosition(targetNote)
    const targetIndex = direction === 'up' ? position.index - 1 : position.index + 1
    const neighbor = position.group[targetIndex]
    if (!neighbor) return

    const nextOrder = [...notes].sort(compareNotesForList)
    const sourceIndex = nextOrder.findIndex((note) => note.id === targetNote.id)
    const neighborIndex = nextOrder.findIndex((note) => note.id === neighbor.id)
    if (sourceIndex < 0 || neighborIndex < 0) return

    ;[nextOrder[sourceIndex], nextOrder[neighborIndex]] = [nextOrder[neighborIndex], nextOrder[sourceIndex]]

    setOrderingBusy(true)
    setError('')
    try {
      const persisted = await persistNoteOrder(nextOrder.map((note) => note.id))
      setNotes([...persisted].sort(compareNotesForList))
    } catch {
      setError('No se pudo guardar el nuevo orden cifrado de las notas.')
    } finally {
      setOrderingBusy(false)
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
        setNotes((current) => current.map((note) => movedById.get(note.id) ?? note).sort(compareNotesForList))
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

  function tagNameExists(name: string, exceptId?: string): boolean {
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
        setNotes((current) => current.map((note) => updatedById.get(note.id) ?? note).sort(compareNotesForList))
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
    if (reorderMode) return
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

  async function handleExportBackup() {
    if (backupBusy) return
    setWorkspaceMenuOpen(false)
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    setBackupBusy(true)
    setError('')
    try {
      const result = await downloadEncryptedBackup()
      window.alert(`Backup cifrado creado: ${result.fileName}\n\nIncluye ${result.recordCount} registros cifrados. Guárdalo junto con tu contraseña maestra.`)
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : 'No se pudo crear el backup cifrado de OANIX.')
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleToggleSearch() {
    if (searchOpen) {
      const openNote = selectedIdRef.current
        ? notesRef.current.find((note) => note.id === selectedIdRef.current) ?? null
        : null
      if (openNote) {
        setActiveFolderId(openNote.folderId ?? 'all')
        if (activeTagId !== 'all' && !(openNote.tagIds ?? []).includes(activeTagId)) {
          setActiveTagId('all')
        }
      }
      setSearchOpen(false)
      setSearchQuery('')
      return
    }

    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    selectedIdRef.current = null
    setSelectedId(null)
    setSaveState('idle')
    setNoteMenuId(null)
    setActiveNoteMenuOpen(false)
    setNoteInfoOpen(false)
    setWorkspaceMenuOpen(false)
    setReorderMode(false)
    setSearchOpen(true)

    if (mobileSinglePane()) {
      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')
    }

    window.requestAnimationFrame(() => searchInputRef.current?.focus())
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
    const estimatedMenuHeight = 190
    const spaceBelow = bottomBoundary - buttonRect.bottom
    const spaceAbove = buttonRect.top - topBoundary

    setNoteMenuDirection(
      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'up' : 'down',
    )
    setNoteMenuId(noteId)
  }

  function scrollFolderTabs(direction: 'left' | 'right') {
    const tabs = folderTabsRef.current
    if (!tabs) return
    const distance = Math.max(160, Math.round(tabs.clientWidth * 0.72))
    tabs.scrollBy({
      left: direction === 'right' ? distance : -distance,
      behavior: 'smooth',
    })
  }

  return (
    <main className={`notes-shell${selectedNote ? ' notes-shell--open' : ''}${hasSearchQuery ? ' notes-shell--searching' : ''}`}>
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
              className={`icon-button${searchOpen ? ' icon-button--active' : ''}`}
              type="button"
              onClick={() => void handleToggleSearch()}
              aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar en notas'}
              aria-pressed={searchOpen}
              title={searchOpen ? 'Cerrar búsqueda' : 'Buscar'}
            >
              🔍
            </button>
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
                      setTagManagerOpen(true)
                    }}
                  >
                    <span aria-hidden="true">🏷</span> Administrar etiquetas
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={backupBusy}
                    onClick={() => void handleExportBackup()}
                  >
                    <span aria-hidden="true">🛡</span> {backupBusy ? 'Creando backup…' : 'Exportar backup cifrado'}
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

        {searchOpen && (
          <div className="notes-search" role="search" aria-label="Búsqueda local de notas">
            <div className="notes-search__field">
              <span aria-hidden="true">🔍</span>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar en toda la bóveda"
                autoComplete="off"
                spellCheck={false}
                aria-label="Buscar en títulos y contenido de notas"
              />
              {hasSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                  aria-label="Limpiar búsqueda"
                  title="Limpiar"
                >
                  ×
                </button>
              )}
            </div>
            <div className="notes-search__meta" aria-live="polite">
              {hasSearchQuery
                ? `${searchResults.length} nota${searchResults.length === 1 ? '' : 's'} · ${searchOccurrenceCount} coincidencia${searchOccurrenceCount === 1 ? '' : 's'} · búsqueda global`
                : 'Busca en todas las carpetas y etiquetas · solo contenido descifrado localmente'}
            </div>
          </div>
        )}

        <div className="notes-tabs-shell">
          <button
            className="notes-tabs-scroll-button notes-tabs-scroll-button--left"
            type="button"
            onClick={() => scrollFolderTabs('left')}
            disabled={!folderScrollEdges.left}
            aria-label="Ver carpetas anteriores"
            title="Carpetas anteriores"
          >
            «
          </button>
          <nav
            className="notes-tabs"
            aria-label="Carpetas de notas"
            ref={folderTabsRef}
            onScroll={() => {
              const tabs = folderTabsRef.current
              if (!tabs) return
              const overflow = tabs.scrollWidth > tabs.clientWidth + 4
              setFolderScrollEdges({
                left: overflow && tabs.scrollLeft > 4,
                right: overflow && tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4,
              })
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
          <button
            className="notes-tabs-scroll-button notes-tabs-scroll-button--right"
            type="button"
            onClick={() => scrollFolderTabs('right')}
            disabled={!folderScrollEdges.right}
            aria-label="Ver carpetas siguientes"
            title="Carpetas siguientes"
          >
            »
          </button>
        </div>

        <div
          className="notes-tag-filter"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) 2.7rem 2.7rem' }}
        >
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
            onClick={() => {
              setNoteMenuId(null)
              setReorderMode((active) => !active)
            }}
            disabled={visibleNotes.length < 2 || orderingBusy}
            aria-label={reorderMode ? 'Terminar de ordenar notas' : 'Ordenar notas manualmente'}
            aria-pressed={reorderMode}
            title={reorderMode ? 'Terminar de ordenar' : 'Ordenar notas'}
            style={reorderMode ? {
              borderColor: '#93b4ff',
              background: '#eaf2ff',
              color: '#1d4ed8',
            } : undefined}
          >
            ↕
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
            hasSearchQuery ? (
              <div className="notes-empty">
                <div className="notes-empty__icon" aria-hidden="true">🔍</div>
                <strong>Sin resultados</strong>
                <p>No encontramos “{searchQuery.trim()}” en ninguna nota de la bóveda.</p>
                <button
                  className="empty-action"
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
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
            )
          ) : (
            visibleNotes.map((note) => {
              const position = noteOrderPosition(note)
              return (
                <div
                  className={`note-row${selectedId === note.id ? ' note-row--selected' : ''}${noteMenuId === note.id ? ' note-row--menu-open' : ''}`}
                  key={note.id}
                  data-note-menu-root="true"
                >
                  <button
                    className="note-row__open"
                    type="button"
                    onClick={() => void handleSelectNote(note.id)}
                    aria-disabled={reorderMode}
                    tabIndex={reorderMode ? -1 : undefined}
                  >
                    <span className="note-row__avatar" aria-hidden="true">{noteInitial(note.title)}</span>
                    <span className="note-row__body">
                      <span className="note-row__topline">
                        <strong>{note.pinned === true && <span aria-hidden="true">📌 </span>}{note.title}</strong>
                        <time dateTime={note.updatedAt}>{formatNoteTime(note.updatedAt)}</time>
                      </span>
                      <span className="note-row__preview">
                        {hasSearchQuery
                          ? `📁 ${folderName(note.folderId)} · ${searchResultByNoteId.get(note.id)?.totalOccurrences ?? 0} coincidencia${(searchResultByNoteId.get(note.id)?.totalOccurrences ?? 0) === 1 ? '' : 's'}`
                          : notePreview(note)}
                      </span>
                      {hasSearchQuery && searchResultByNoteId.get(note.id) && (
                        <span className="search-result-locations" aria-label="Ubicaciones de las coincidencias">
                          {searchResultByNoteId.get(note.id)?.matches.slice(0, 4).map((match) => (
                            <span className="search-result-location" key={match.key}>
                              <span className="search-result-location__label">
                                {match.label}{match.occurrences > 1 ? ` · ${match.occurrences}×` : ''}
                              </span>
                              <span className="search-result-location__snippet">{match.snippet}</span>
                            </span>
                          ))}
                          {(searchResultByNoteId.get(note.id)?.matches.length ?? 0) > 4 && (
                            <span className="search-result-location__more">
                              +{(searchResultByNoteId.get(note.id)?.matches.length ?? 0) - 4} ubicaciones más
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>

                  {reorderMode && !hasSearchQuery ? (
                    <div
                      aria-label={`Orden manual de ${note.title}`}
                      style={{
                        flex: '0 0 auto',
                        display: 'grid',
                        gridTemplateColumns: '1.9rem 1.9rem',
                        alignItems: 'center',
                        gap: '.1rem',
                        paddingRight: '.45rem',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void handleMoveNoteOrder(note, 'up')}
                        disabled={orderingBusy || !position.canMoveUp}
                        aria-label={`Mover ${note.title} arriba`}
                        title="Mover arriba"
                        style={{
                          width: '1.9rem',
                          height: '2.35rem',
                          padding: 0,
                          border: 0,
                          borderRadius: '.55rem',
                          background: position.canMoveUp ? '#eef4ff' : 'transparent',
                          color: '#1d4ed8',
                          fontWeight: 900,
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMoveNoteOrder(note, 'down')}
                        disabled={orderingBusy || !position.canMoveDown}
                        aria-label={`Mover ${note.title} abajo`}
                        title="Mover abajo"
                        style={{
                          width: '1.9rem',
                          height: '2.35rem',
                          padding: 0,
                          border: 0,
                          borderRadius: '.55rem',
                          background: position.canMoveDown ? '#eef4ff' : 'transparent',
                          color: '#1d4ed8',
                          fontWeight: 900,
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  ) : (
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
                            onClick={() => void handleTogglePinned(note)}
                          >
                            {note.pinned === true ? 'Desfijar nota' : 'Fijar nota'}
                          </button>
                          <button
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
                  )}
                </div>
              )
            })
          )}
        </div>

        {!hasSearchQuery && (
          <button
            className="notes-create-fab"
            type="button"
            onClick={() => void handleCreateNote()}
            disabled={creating || reorderMode}
            aria-label={creating ? 'Creando nota' : 'Crear nueva nota'}
            title={reorderMode ? 'Termina de ordenar para crear una nota' : 'Nueva nota'}
          >
            <span aria-hidden="true">＋</span>
            <span>{creating ? 'Creando…' : 'Nueva nota'}</span>
          </button>
        )}
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
                  <strong>{selectedNote.pinned === true && <span aria-hidden="true">📌 </span>}{selectedNote.title}</strong>
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
                      onClick={() => void handleTogglePinned(selectedNote)}
                    >
                      <span aria-hidden="true">📌</span> {selectedNote.pinned === true ? 'Desfijar nota' : 'Fijar nota'}
                    </button>
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

              <div className="note-tag-strip" aria-label="Etiquetas de la nota">
                {tagRecordsFor(selectedNote).map((tag) => (
                  <span className="note-tag-chip" key={tag.id}>#{tag.name}</span>
                ))}
                <button type="button" className="note-tag-add" onClick={() => openTagEditor(selectedNote)}>
                  ＋ Etiqueta
                </button>
              </div>

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
                <div><dt>Fijada</dt><dd>{selectedNote.pinned === true ? 'Sí' : 'No'}</dd></div>
                <div><dt>Carpeta</dt><dd>{folderName(selectedNote.folderId)}</dd></div>
                <div><dt>Etiquetas</dt><dd>{tagRecordsFor(selectedNote).map((tag) => tag.name).join(', ') || 'Sin etiquetas'}</dd></div>
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

      {tagFilterOpen && (
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
