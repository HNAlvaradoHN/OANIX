import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { deleteEncryptedImage } from '../images/imageService'
import { downloadEncryptedBackup } from '../backup/backupService'
import { createFolder, deleteFolder, loadFolders, renameFolder, reorderFolder } from '../folders/folderService'
import { saveFolderColor, saveFolderIcon } from '../folders/folderAppearanceService'
import type { FolderRecord } from '../folders/folderTypes'
import type { FolderIcon } from '../folders/folderAppearanceCatalog'
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
  renameNote,
  replaceNoteContent,
  setNoteListAppearance,
  setNotePinned,
  setNoteTags,
  type NoteListAppearanceInput,
} from './noteService'
import { searchItemsByLocalFields, type LocalSearchField } from '../search/localSearch'
import { prepareDailyEntriesForEditing } from './dailyEntries'
import { WORKSPACE_V2_ENABLED } from '../../app/workspaceExperience'
import { NoteAvatar } from './NoteAvatar'
import { WorkspaceV2Sidebar } from './WorkspaceV2Sidebar'
import { AuroraNoteSheet } from './themes/aurora/AuroraNoteSheet'
import {
  saveWorkspaceV2FolderOrder,
  saveWorkspaceV2NoteOrder,
  saveWorkspaceV2TagOrder,
} from './workspaceV2OrderService'
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

function setNoteDeleteFeedback(active: boolean) {
  const id = 'oanix-note-delete-feedback'
  const existing = document.getElementById(id)
  if (!active) {
    existing?.remove()
    return
  }
  if (existing) return

  const feedback = document.createElement('div')
  feedback.id = id
  feedback.setAttribute('role', 'status')
  feedback.setAttribute('aria-live', 'polite')
  feedback.style.position = 'fixed'
  feedback.style.zIndex = '7600'
  feedback.style.left = '50%'
  feedback.style.top = 'max(86px, calc(env(safe-area-inset-top, 0px) + 72px))'
  feedback.style.transform = 'translateX(-50%)'
  feedback.style.display = 'flex'
  feedback.style.alignItems = 'center'
  feedback.style.gap = '10px'
  feedback.style.width = 'max-content'
  feedback.style.maxWidth = 'calc(100vw - 32px)'
  feedback.style.padding = '10px 14px'
  feedback.style.border = '1px solid rgba(96,165,250,.32)'
  feedback.style.borderRadius = '14px'
  feedback.style.background = 'rgba(15,23,42,.92)'
  feedback.style.color = '#f8fafc'
  feedback.style.boxShadow = '0 14px 34px rgba(0,0,0,.32)'
  feedback.style.backdropFilter = 'blur(16px)'
  feedback.style.setProperty('-webkit-backdrop-filter', 'blur(16px)')
  feedback.style.pointerEvents = 'none'

  const icon = document.createElement('span')
  icon.setAttribute('aria-hidden', 'true')
  icon.textContent = '⏳'
  icon.style.fontSize = '18px'
  icon.style.lineHeight = '1'

  const copy = document.createElement('span')
  copy.style.display = 'grid'
  copy.style.gap = '2px'

  const title = document.createElement('strong')
  title.textContent = 'Eliminando nota…'
  title.style.fontSize = '12px'
  title.style.fontWeight = '900'
  title.style.lineHeight = '1.2'

  const detail = document.createElement('small')
  detail.textContent = 'Actualizando tu bóveda cifrada'
  detail.style.color = 'rgba(226,232,240,.72)'
  detail.style.fontSize = '9px'
  detail.style.lineHeight = '1.2'

  copy.append(title, detail)
  feedback.append(icon, copy)
  document.body.appendChild(feedback)
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [noteMenuId, setNoteMenuId] = useState<string | null>(null)
  const [noteMenuDirection, setNoteMenuDirection] = useState<'down' | 'up'>('down')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  const folderTabsRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const pendingContentRef = useRef<PendingContent | null>(null)
  const activeSaveRef = useRef<Promise<boolean> | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const activeFolderIdRef = useRef<string | 'all'>('all')
  const activeTagIdRef = useRef<string | 'all'>('all')
  const notesRef = useRef<NoteRecord[]>([])
  const pendingV2FolderOrderRef = useRef<string[] | null>(null)
  const v2FolderOrderLoopRef = useRef<Promise<void> | null>(null)
  const pendingV2TagOrderRef = useRef<string[] | null>(null)
  const v2TagOrderLoopRef = useRef<Promise<void> | null>(null)
  const pendingV2NoteOrderRef = useRef<string[] | null>(null)
  const v2NoteOrderLoopRef = useRef<Promise<void> | null>(null)
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
    activeFolderIdRef.current = activeFolderId
  }, [activeFolderId])

  useEffect(() => {
    activeTagIdRef.current = activeTagId
  }, [activeTagId])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('oanix:workspace-count-changed', {
      detail: { count: organizedNotes.length },
    }))
  }, [organizedNotes.length])

  useEffect(() => {
    const handleWorkspaceFolderSelection = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { folderId?: unknown } | null
        : null
      if (typeof detail?.folderId !== 'string') return
      handleSelectFolder(detail.folderId)
    }

    window.addEventListener('oanix:select-workspace-folder', handleWorkspaceFolderSelection)
    return () => window.removeEventListener('oanix:select-workspace-folder', handleWorkspaceFolderSelection)
  }, [])

  useEffect(() => {
    const handleWorkspaceTagSelection = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { tagId?: unknown } | null
        : null
      if (detail?.tagId === null) {
        void handleSelectTag('all')
        return
      }
      if (typeof detail?.tagId !== 'string') return
      void handleSelectTag(detail.tagId)
    }

    window.addEventListener('oanix:select-workspace-tag', handleWorkspaceTagSelection)
    return () => window.removeEventListener('oanix:select-workspace-tag', handleWorkspaceTagSelection)
  }, [])

  useEffect(() => {
    function handlePreviewNoteOrder(event: Event) {
      const detail = event instanceof CustomEvent
        ? event.detail as { orderedIds?: unknown } | null
        : null
      if (!Array.isArray(detail?.orderedIds) || !detail.orderedIds.every((id) => typeof id === 'string')) return
      const orderedIds = detail.orderedIds as string[]
      const orderedSet = new Set(orderedIds)
      setNotes((current) => {
        const byId = new Map(current.map((note) => [note.id, note]))
        const orderedNotes = orderedIds.flatMap((id) => byId.get(id) ?? [])
        if (orderedNotes.length !== orderedIds.length) return current
        let orderedIndex = 0
        return current.map((note) => orderedSet.has(note.id) ? orderedNotes[orderedIndex++] : note)
      })
    }

    window.addEventListener('oanix:note-order-preview', handlePreviewNoteOrder)
    return () => window.removeEventListener('oanix:note-order-preview', handlePreviewNoteOrder)
  }, [])

  useEffect(() => {
    function handlePersistedNoteOrder(event: Event) {
      const detail = event instanceof CustomEvent
        ? event.detail as { notes?: unknown } | null
        : null
      if (!Array.isArray(detail?.notes)) return

      const manualOrderById = new Map<string, number>()
      for (const entry of detail.notes) {
        if (!entry || typeof entry !== 'object') continue
        const candidate = entry as { id?: unknown; manualOrder?: unknown }
        if (typeof candidate.id !== 'string' || !Number.isSafeInteger(candidate.manualOrder)) continue
        manualOrderById.set(candidate.id, candidate.manualOrder as number)
      }
      if (manualOrderById.size === 0) return

      setNotes((current) => current
        .map((note) => {
          const manualOrder = manualOrderById.get(note.id)
          return manualOrder === undefined ? note : { ...note, manualOrder }
        })
        .sort(compareNotesForList))
    }

    window.addEventListener('oanix:note-order-persisted', handlePersistedNoteOrder)
    return () => window.removeEventListener('oanix:note-order-persisted', handlePersistedNoteOrder)
  }, [])

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
      setNoteDeleteFeedback(false)
    }
  }, [])

  useEffect(() => {
    function closeNoteMenu(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && target.closest('[data-note-menu-root="true"]')) return
      setNoteMenuId(null)
      setWorkspaceMenuOpen(false)
    }

    function closeNoteMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNoteMenuId(null)
        setWorkspaceMenuOpen(false)
        setMoveNoteId(null)
        setFolderManagerOpen(false)
        setTagFilterOpen(false)
        setTagManagerOpen(false)
        setTagEditorNoteId(null)
        setSearchOpen(false)
        setSearchQuery('')
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

  async function handleDeleteNote(targetNote: NoteRecord, confirmationAlreadyShown = false) {
    if (deletingId) return

    if (!confirmationAlreadyShown) {
      const confirmed = window.confirm(
        `¿Eliminar esta nota de forma permanente?\n\n“${targetNote.title}” se eliminará de este dispositivo junto con sus imágenes asociadas. Esta acción no se puede deshacer.`,
      )
      if (!confirmed) return
    }

    const noteId = targetNote.id
    const deletingSelectedNote = selectedIdRef.current === noteId

    setDeletingId(noteId)
    setNoteMenuId(null)
    setError('')
    setNoteDeleteFeedback(true)

    let pendingRemovedCleanup: Promise<void> | null = null

    try {
      if (deletingSelectedNote) {
        if (!(await flushPendingContent())) {
          setDeletingId(null)
          setNoteDeleteFeedback(false)
          return
        }
        pendingRemovedCleanup = finalizeRemovedImages()
      }

      const deleted = await deleteNote(noteId)
      const imageIds = deleted.content.blocks.flatMap((block) =>
        block.type === 'image' ? [block.imageId] : [],
      )

      setNotes((current) => current.filter((note) => note.id !== noteId))

      if (deletingSelectedNote) {
        clearSaveTimer()
        pendingContentRef.current = null
        selectedIdRef.current = null
        setSelectedId(null)
        setSaveState('idle')
        setMoveNoteId(null)
        setTagEditorNoteId(null)

        if (mobileSinglePane()) {
          const historyState: Record<string, unknown> = { ...currentHistoryState(), oanixView: 'list' }
          delete historyState.noteId
          window.history.replaceState(historyState, '')
        }
      }

      setError('')
      setDeletingId(null)
      setNoteDeleteFeedback(false)

      void Promise.all([
        pendingRemovedCleanup ?? Promise.resolve(),
        Promise.allSettled(imageIds.map((imageId) => deleteEncryptedImage(imageId))),
      ])
    } catch {
      if (deletingSelectedNote) setSaveState('error')
      setError('No se pudo eliminar la nota cifrada.')
      setDeletingId(null)
      setNoteDeleteFeedback(false)
    }
  }

  function pushMobileNoteHistory(noteId: string) {
    if (!mobileSinglePane()) return
    window.history.pushState(
      { ...currentHistoryState(), oanixView: 'note', noteId },
      '',
    )
  }

  function handleSelectFolder(folderId: string | 'all') {
    if (folderId === activeFolderIdRef.current) return

    activeFolderIdRef.current = folderId
    void flushPendingContent()
    void finalizeRemovedImages()

    setActiveFolderId(folderId)
    selectedIdRef.current = null
    setSelectedId(null)
    setSaveState('idle')
    setNoteMenuId(null)

    if (mobileSinglePane()) {
      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')
    }

    window.dispatchEvent(new CustomEvent('oanix:workspace-folder-committed', {
      detail: { folderId },
    }))
  }

  async function handleSelectTag(tagId: string | 'all') {
    if (tagId === activeTagIdRef.current) {
      setTagFilterOpen(false)
      return
    }
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    activeTagIdRef.current = tagId
    setActiveTagId(tagId)
    selectedIdRef.current = null
    setSelectedId(null)
    setSaveState('idle')
    setNoteMenuId(null)
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
      handleSelectFolder(folder.id)
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

  async function handleV2CreateFolder(
    nextName: string,
    appearance: { icon: FolderIcon; color: string },
  ) {
    const name = nextName.trim().replace(/\s+/g, ' ')
    if (!name) throw new Error('Escribe un nombre para la carpeta.')
    if (folderNameExists(name)) throw new Error('Ya existe una carpeta con ese nombre.')

    const folder = await createFolder(name)
    setFolders((current) => [...current, folder])
    handleSelectFolder(folder.id)

    try {
      await Promise.all([
        saveFolderColor(folder.id, appearance.color),
        saveFolderIcon(folder.id, appearance.icon),
      ])
    } catch {
      setError('La carpeta se creó, pero no se pudo guardar toda su apariencia.')
    }
  }

  async function handleV2RenameFolder(folder: FolderRecord, nextName: string) {
    const name = nextName.trim().replace(/\s+/g, ' ')
    if (!name) throw new Error('El nombre de la carpeta no puede estar vacío.')
    if (folderNameExists(name, folder.id)) throw new Error('Ya existe una carpeta con ese nombre.')
    if (name === folder.name) return

    const updated = await renameFolder(folder.id, name)
    setFolders((current) => current.map((item) => item.id === updated.id ? updated : item))
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
    } catch {
      setError('No se pudo mover la nota a la carpeta seleccionada.')
    } finally {
      setFolderBusyId(null)
    }
  }

  async function handleTogglePinned(targetNote: NoteRecord) {
    if (targetNote.id === selectedIdRef.current && !(await flushPendingContent())) return

    setNoteMenuId(null)
    setError('')
    try {
      const updated = await setNotePinned(targetNote.id, targetNote.pinned !== true)
      replaceNoteInState(updated)
      if (updated.id === selectedIdRef.current) setSaveState('saved')
    } catch {
      setError('No se pudo cambiar el estado fijado de la nota.')
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
      if (activeFolderId === folder.id) handleSelectFolder('all')
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

  async function handleV2CreateTag(
    name: string,
    appearance: { icon: string; color: string },
  ) {
    const normalized = name.trim().replace(/\s+/g, ' ')
    if (!normalized) throw new Error('Escribe un nombre para la etiqueta.')
    if (tagNameExists(normalized)) throw new Error('Ya existe una etiqueta con ese nombre.')

    const tag = await createTag(normalized, appearance)
    setTags((current) => sortTagState([...current, tag]))
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

  async function handleAuroraAddTag(name: string) {
    const targetNote = notesRef.current.find((note) => note.id === selectedIdRef.current) ?? null
    if (!targetNote) return

    const normalized = name.trim().replace(/^#/, '').replace(/\s+/g, ' ')
    if (!normalized) return
    if (!(await flushPendingContent())) return

    setError('')
    try {
      let tag = tags.find((candidate) => candidate.name.toLocaleLowerCase() === normalized.toLocaleLowerCase()) ?? null
      if (!tag) {
        tag = await createTag(normalized)
        setTags((current) => sortTagState([...current, tag!]))
      }

      if ((targetNote.tagIds ?? []).includes(tag.id)) return
      const updated = await setNoteTags(targetNote.id, [...(targetNote.tagIds ?? []), tag.id])
      replaceNoteInState(updated)
      setSaveState('saved')
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : 'No se pudo añadir la etiqueta a la nota.')
    }
  }

  async function handleAuroraRemoveTag(tagId: string) {
    const targetNote = notesRef.current.find((note) => note.id === selectedIdRef.current) ?? null
    const tag = tags.find((candidate) => candidate.id === tagId) ?? null
    if (!targetNote || !tag || !(targetNote.tagIds ?? []).includes(tagId)) return
    if (!window.confirm(`¿Quitar la etiqueta “${tag.name}” de esta nota?`)) return
    if (!(await flushPendingContent())) return

    setError('')
    try {
      const updated = await setNoteTags(targetNote.id, (targetNote.tagIds ?? []).filter((id) => id !== tagId))
      replaceNoteInState(updated)
      setSaveState('saved')
    } catch {
      setError('No se pudo quitar la etiqueta de la nota.')
    }
  }

  async function handleAuroraRenameTag(tagId: string, nextName: string) {
    const target = tags.find((tag) => tag.id === tagId)
    if (!target) return

    const normalized = nextName.trim().replace(/\s+/g, ' ')
    if (!normalized || normalized === target.name) return
    if (tagNameExists(normalized, tagId)) {
      setError('Ya existe una etiqueta con ese nombre.')
      return
    }

    setError('')
    try {
      const updated = await renameTag(tagId, normalized)
      setTags((current) => sortTagState(current.map((tag) => tag.id === tagId ? updated : tag)))
    } catch {
      setError('No se pudo renombrar la etiqueta.')
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
        activeTagIdRef.current = 'all'
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
    setNoteMenuId(null)
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
        handleSelectFolder(openNote.folderId ?? 'all')
        if (activeTagId !== 'all' && !(openNote.tagIds ?? []).includes(activeTagId)) {
          activeTagIdRef.current = 'all'
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
    setWorkspaceMenuOpen(false)
    setSearchOpen(true)

    if (mobileSinglePane()) {
      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')
    }

    window.requestAnimationFrame(() => searchInputRef.current?.focus())
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

  async function handleV2CustomizeNote(noteId: string, input: NoteListAppearanceInput) {
    if (noteId === selectedIdRef.current && !(await flushPendingContent())) {
      throw new Error('No se pudo confirmar el guardado actual antes de personalizar.')
    }

    const updated = await setNoteListAppearance(noteId, input)
    replaceNoteInState(updated)
    if (updated.id === selectedIdRef.current) {
      setDraftTitle(updated.title)
      setSaveState('saved')
    }
    window.dispatchEvent(new CustomEvent('oanix:note-visual-changed', {
      detail: { note: updated },
    }))
  }

  function handleV2FolderOrder(folderIds: string[]) {
    if (folderIds.length !== folders.length) return
    pendingV2FolderOrderRef.current = [...folderIds]
    if (v2FolderOrderLoopRef.current) return

    v2FolderOrderLoopRef.current = (async () => {
      while (pendingV2FolderOrderRef.current) {
        const orderToPersist = pendingV2FolderOrderRef.current
        pendingV2FolderOrderRef.current = null
        try {
          const persisted = await saveWorkspaceV2FolderOrder(orderToPersist)
          if (pendingV2FolderOrderRef.current) continue
          setFolders(persisted)
        } catch {
          if (!pendingV2FolderOrderRef.current) {
            setError('No se pudo guardar el nuevo orden de las carpetas.')
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
          }
        }
      }
    })().finally(() => {
      v2FolderOrderLoopRef.current = null
      const pending = pendingV2FolderOrderRef.current
      if (pending) handleV2FolderOrder(pending)
    })
  }

  function handleV2TagOrder(tagIds: string[]) {
    if (tagIds.length !== tags.length) return
    pendingV2TagOrderRef.current = [...tagIds]
    if (v2TagOrderLoopRef.current) return

    v2TagOrderLoopRef.current = (async () => {
      while (pendingV2TagOrderRef.current) {
        const orderToPersist = pendingV2TagOrderRef.current
        pendingV2TagOrderRef.current = null
        try {
          const persisted = await saveWorkspaceV2TagOrder(orderToPersist)
          if (pendingV2TagOrderRef.current) continue
          setTags(persisted)
        } catch {
          if (!pendingV2TagOrderRef.current) {
            setError('No se pudo guardar el nuevo orden de las etiquetas.')
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
          }
        }
      }
    })().finally(() => {
      v2TagOrderLoopRef.current = null
      const pending = pendingV2TagOrderRef.current
      if (pending) handleV2TagOrder(pending)
    })
  }

  function handleV2NoteOrder(noteIds: string[]) {
    if (noteIds.length === 0 || hasSearchQuery) return
    pendingV2NoteOrderRef.current = [...noteIds]
    if (v2NoteOrderLoopRef.current) return

    v2NoteOrderLoopRef.current = (async () => {
      while (pendingV2NoteOrderRef.current) {
        const orderToPersist = pendingV2NoteOrderRef.current
        pendingV2NoteOrderRef.current = null
        try {
          const persisted = await saveWorkspaceV2NoteOrder(
            orderToPersist,
            () => pendingV2NoteOrderRef.current === null,
          )
          if (pendingV2NoteOrderRef.current) continue
          const manualOrderById = new Map(persisted.map((note) => [note.id, note.manualOrder]))
          setNotes((current) => current
            .map((note) => manualOrderById.has(note.id)
              ? { ...note, manualOrder: manualOrderById.get(note.id) }
              : note)
            .sort(compareNotesForList))
          window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
            detail: { recordType: 'note' },
          }))
        } catch {
          if (!pendingV2NoteOrderRef.current) {
            setError('No se pudo guardar el nuevo orden de las notas.')
            window.dispatchEvent(new Event('oanix:workspace-refresh'))
          }
        }
      }
    })().finally(() => {
      v2NoteOrderLoopRef.current = null
      const pending = pendingV2NoteOrderRef.current
      if (pending) handleV2NoteOrder(pending)
    })
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
    <main className={`notes-shell${WORKSPACE_V2_ENABLED ? ' oanix-workspace-v2-shell' : ''}${selectedNote ? ' notes-shell--open' : ''}${hasSearchQuery ? ' notes-shell--searching' : ''}`}>
      {WORKSPACE_V2_ENABLED ? (
        <WorkspaceV2Sidebar
          folders={folders}
          tags={tags}
          notes={notes}
          visibleNotes={visibleNotes}
          loading={loading}
          creating={creating}
          deletingId={deletingId}
          error={error}
          selectedId={selectedId}
          activeFolderId={activeFolderId}
          activeTagId={activeTagId}
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          searchInputRef={searchInputRef}
          workspaceMenuOpen={workspaceMenuOpen}
          backupBusy={backupBusy}
          onSearchToggle={() => void handleToggleSearch()}
          onSearchQueryChange={setSearchQuery}
          onClearSearch={() => {
            setSearchQuery('')
            window.requestAnimationFrame(() => searchInputRef.current?.focus())
          }}
          onLock={() => void handleLockWorkspace()}
          onWorkspaceMenuToggle={() => setWorkspaceMenuOpen((open) => !open)}
          onOpenFolderManager={() => {
            setWorkspaceMenuOpen(false)
            setFolderManagerOpen(true)
          }}
          onOpenTagManager={() => {
            setWorkspaceMenuOpen(false)
            setTagManagerOpen(true)
          }}
          onExportBackup={() => void handleExportBackup()}
          onSelectFolder={handleSelectFolder}
          onSelectTag={(tagId) => void handleSelectTag(tagId)}
          onCreateNote={() => void handleCreateNote()}
          onSelectNote={(noteId) => void handleSelectNote(noteId)}
          onTogglePinned={(note) => void handleTogglePinned(note)}
          onOpenTagEditor={openTagEditor}
          onOpenMoveNote={(note) => setMoveNoteId(note.id)}
          onDeleteNote={(note) => void handleDeleteNote(note)}
          onCreateTag={handleV2CreateTag}
          onDeleteTag={handleDeleteTag}
          onCreateFolder={handleV2CreateFolder}
          onRenameFolder={handleV2RenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onCustomizeNote={handleV2CustomizeNote}
          onFolderOrder={(ids) => void handleV2FolderOrder(ids)}
          onTagOrder={(ids) => void handleV2TagOrder(ids)}
          onNoteOrder={(ids) => void handleV2NoteOrder(ids)}
        />
      ) : (
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
              onClick={() => handleSelectFolder('all')}
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
                onClick={() => handleSelectFolder(folder.id)}
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
          style={{ gridTemplateColumns: 'minmax(0, 1fr) 2.7rem' }}
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
            visibleNotes.map((note) => (
              <div
                className={`note-row${selectedId === note.id ? ' note-row--selected' : ''}${noteMenuId === note.id ? ' note-row--menu-open' : ''}`}
                key={note.id}
                data-note-menu-root="true"
                data-reorder-note-id={note.id}
              >
                <button
                  className="note-row__open"
                  type="button"
                  onClick={() => void handleSelectNote(note.id)}
                >
                  <NoteAvatar note={note} className="note-row__avatar" />
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
              </div>
            ))
          )}
        </div>

        {!hasSearchQuery && (
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
        )}
      </aside>
      )}

      <section className="note-view" aria-label="Nota abierta">
        {selectedNote ? (
          <AuroraNoteSheet
            note={selectedNote}
            folders={folders}
            tags={tags}
            draftTitle={draftTitle}
            saveLabel={saveStateLabel(saveState, savingTitle)}
            savingTitle={savingTitle}
            deleting={deletingSelected}
            error={error}
            editor={(
              <ImageNoteEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                initialBlocks={prepareDailyEntriesForEditing(selectedNote)}
                onChange={handleContentChange}
                onBlur={() => void flushPendingContent()}
                onRemoveImage={handleRemovedImage}
                onRestoreImage={handleRestoredImage}
              />
            )}
            onBack={() => void handleBack()}
            onDraftTitleChange={setDraftTitle}
            onCommitTitle={() => void persistTitle()}
            onTogglePinned={() => void handleTogglePinned(selectedNote)}
            onAddTag={handleAuroraAddTag}
            onRemoveTag={handleAuroraRemoveTag}
            onRenameTag={handleAuroraRenameTag}
            onMoveToFolder={async (folderId) => { await handleMoveNote(selectedNote, folderId) }}
            onDeleteNote={() => void handleDeleteNote(selectedNote, true)}
            onRetrySave={() => void flushPendingContent()}
          />
        ) : (
          <div className="note-view__empty">
            <div className="note-view__empty-mark" aria-hidden="true">O</div>
            <strong>Selecciona una nota</strong>
            <p>La experiencia se organiza como una lista de conversaciones, pero cada elemento es una nota privada.</p>
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
            {!WORKSPACE_V2_ENABLED && (
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
            )}
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
