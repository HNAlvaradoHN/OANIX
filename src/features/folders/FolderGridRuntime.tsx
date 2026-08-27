import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes } from '../notes/noteService'
import { noteBlocksToPlainText, type NoteRecord } from '../notes/noteTypes'
import { listNotePrivacy } from '../privacy/notePrivacyService'
import {
  loadFolderCovers,
  prepareFolderCover,
  removeFolderCover,
  saveFolderCover,
} from './folderCoverService'
import { loadFolderColors } from './folderAppearanceService'
import { loadFolders, persistFolderOrder } from './folderService'
import type { FolderRecord } from './folderTypes'
import './folderGrid.css'
import './folderInteractive.css'

interface FolderGridTargets {
  sidebar: HTMLElement | null
  tabsShell: HTMLElement | null
  header: HTMLElement | null
  searchOpen: boolean
  activeLabel: string
}

interface FolderGridData {
  folders: FolderRecord[]
  notes: NoteRecord[]
  allCount: number
  counts: Map<string, number>
  covers: Map<string, string>
  colors: Map<string, string>
}

interface FolderDragGhost {
  folderId: string
  name: string
  noteCount: number
  cover: string
  left: number
  top: number
  width: number
  height: number
  offsetX: number
  offsetY: number
}

const EMPTY_DATA: FolderGridData = {
  folders: [],
  notes: [],
  allCount: 0,
  counts: new Map(),
  covers: new Map(),
  colors: new Map(),
}

const FOLDER_LONG_PRESS_MS = 460
const FOLDER_SHAPES = ['blob-a', 'circle', 'squircle', 'blob-b', 'diamond', 'hexagon'] as const

function currentTargets(): FolderGridTargets {
  const sidebar = document.querySelector<HTMLElement>('.notes-sidebar')
  const tabsShell = sidebar?.querySelector<HTMLElement>('.notes-tabs-shell') ?? null
  const activeTab = tabsShell?.querySelector<HTMLButtonElement>('.notes-tab[aria-current="page"]') ?? null

  return {
    sidebar,
    tabsShell,
    header: sidebar?.querySelector<HTMLElement>('.notes-header') ?? null,
    searchOpen: Boolean(sidebar?.querySelector('.notes-search')),
    activeLabel: activeTab?.textContent?.trim() || 'Todas las notas',
  }
}

function sameTargets(left: FolderGridTargets, right: FolderGridTargets): boolean {
  return (
    left.sidebar === right.sidebar
    && left.tabsShell === right.tabsShell
    && left.header === right.header
    && left.searchOpen === right.searchOpen
    && left.activeLabel === right.activeLabel
  )
}

function visibleFolderTabButtons(tabsShell: HTMLElement | null): HTMLButtonElement[] {
  if (!tabsShell) return []
  return Array.from(tabsShell.querySelectorAll<HTMLButtonElement>('.notes-tab:not(.notes-tab--add)'))
}

function moveFolderAroundTarget(
  folders: FolderRecord[],
  draggedId: string,
  targetId: string,
  placeAfter: boolean,
): FolderRecord[] {
  if (draggedId === targetId) return folders
  const fromIndex = folders.findIndex((folder) => folder.id === draggedId)
  const targetIndex = folders.findIndex((folder) => folder.id === targetId)
  if (fromIndex < 0 || targetIndex < 0) return folders

  const next = [...folders]
  const [dragged] = next.splice(fromIndex, 1)
  const insertionTarget = next.findIndex((folder) => folder.id === targetId)
  if (insertionTarget < 0) return folders
  next.splice(insertionTarget + (placeAfter ? 1 : 0), 0, dragged)
  return next
}

function captureFolderRects(): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>()
  document.querySelectorAll<HTMLElement>('.oanix-folder-rail__item[data-oanix-folder-id]').forEach((element) => {
    const folderId = element.dataset.oanixFolderId
    if (folderId) rects.set(folderId, element.getBoundingClientRect())
  })
  return rects
}

function animateFolderReflow(before: Map<string, DOMRect>, draggingFolderId: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('.oanix-folder-rail__item[data-oanix-folder-id]').forEach((element) => {
        const folderId = element.dataset.oanixFolderId
        if (!folderId || folderId === draggingFolderId) return
        const previous = before.get(folderId)
        if (!previous) return
        const next = element.getBoundingClientRect()
        const deltaX = previous.left - next.left
        const deltaY = previous.top - next.top
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return
        element.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 180, easing: 'cubic-bezier(.2,.75,.25,1)' },
        )
      })
    })
  })
}

function scheduleNoteOpen(noteId: string) {
  window.setTimeout(() => {
    const selector = `[data-reorder-note-id="${CSS.escape(noteId)}"] .note-row__open`
    document.querySelector<HTMLButtonElement>(selector)?.click()
  }, 80)
}

export function FolderGridRuntime() {
  const [targets, setTargets] = useState<FolderGridTargets>(() => currentTargets())
  const [gridOpen, setGridOpen] = useState(true)
  const [data, setData] = useState<FolderGridData>(EMPTY_DATA)
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all')
  const [panelSearch, setPanelSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customFolder, setCustomFolder] = useState<FolderRecord | null>(null)
  const [customBusy, setCustomBusy] = useState(false)
  const [customError, setCustomError] = useState('')
  const [reorderMode, setReorderMode] = useState(false)
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null)
  const [dragGhost, setDragGhost] = useState<FolderDragGhost | null>(null)
  const [orderingBusy, setOrderingBusy] = useState(false)
  const gridOpenRef = useRef(gridOpen)
  const refreshTimerRef = useRef<number | null>(null)
  const refreshRequestRef = useRef(0)
  const longPressTimerRef = useRef<number | null>(null)
  const suppressFolderSelectRef = useRef<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const dragStartOrderRef = useRef<string[]>([])
  const pendingFolderOrderRef = useRef<string[] | null>(null)
  const folderOrderPersistingRef = useRef(false)

  useEffect(() => {
    gridOpenRef.current = gridOpen
  }, [gridOpen])

  useEffect(() => {
    const handleMobileOrderPreview = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { orderedIds?: unknown } | null
        : null
      if (!Array.isArray(detail?.orderedIds) || !detail.orderedIds.every((id) => typeof id === 'string')) return

      const orderedIds = detail.orderedIds as string[]
      let accepted = false
      setData((current) => {
        if (orderedIds.length !== current.folders.length) return current
        const byId = new Map(current.folders.map((folder) => [folder.id, folder]))
        if (orderedIds.some((id) => !byId.has(id))) return current
        const nextFolders = orderedIds.map((id) => byId.get(id)!)
        accepted = nextFolders.some((folder, index) => folder.id !== current.folders[index]?.id)
        return accepted ? { ...current, folders: nextFolders } : current
      })
      if (accepted) queueFolderOrderPersistence(orderedIds)
    }

    window.addEventListener('oanix:folder-order-preview', handleMobileOrderPreview)
    return () => window.removeEventListener('oanix:folder-order-preview', handleMobileOrderPreview)
  }, [])

  useEffect(() => {
    const handleCommittedFolder = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { folderId?: unknown } | null
        : null
      if (typeof detail?.folderId !== 'string') return
      setSelectedFolderId(detail.folderId)
    }

    window.addEventListener('oanix:workspace-folder-committed', handleCommittedFolder)
    return () => window.removeEventListener('oanix:workspace-folder-committed', handleCommittedFolder)
  }, [])

  async function refreshData() {
    const request = ++refreshRequestRef.current
    setLoading(true)
    setError('')

    try {
      const [folders, notes, privacy, covers, colors] = await Promise.all([
        loadFolders(),
        loadNotes(),
        listNotePrivacy(),
        loadFolderCovers(),
        loadFolderColors(),
      ])
      if (request !== refreshRequestRef.current) return

      const privateNoteIds = new Set(
        privacy.filter((record) => record.privateBox === true).map((record) => record.noteId),
      )
      const visibleNotes = notes.filter((note) => !privateNoteIds.has(note.id))
      const counts = new Map<string, number>()
      for (const note of visibleNotes) {
        if (!note.folderId) continue
        counts.set(note.folderId, (counts.get(note.folderId) ?? 0) + 1)
      }

      setData({ folders, notes: visibleNotes, allCount: visibleNotes.length, counts, covers, colors })
      setSelectedFolderId((current) => (
        current === 'all' || folders.some((folder) => folder.id === current) ? current : 'all'
      ))
    } catch {
      if (request === refreshRequestRef.current) {
        setError('No se pudieron cargar las carpetas cifradas.')
      }
    } finally {
      if (request === refreshRequestRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    let frame = 0
    const refreshTargets = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const next = currentTargets()
        setTargets((current) => sameTargets(current, next) ? current : next)
      })
    }

    refreshTargets()
    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    if (!workspace) {
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new MutationObserver(refreshTargets)
    observer.observe(workspace, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current', 'class'],
    })

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const sidebar = targets.sidebar
    const header = targets.header
    if (!sidebar || !header) return

    const updateTop = () => {
      sidebar.style.setProperty('--oanix-folder-grid-top', `${Math.ceil(header.getBoundingClientRect().height)}px`)
    }
    updateTop()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateTop)
      return () => {
        window.removeEventListener('resize', updateTop)
        sidebar.style.removeProperty('--oanix-folder-grid-top')
      }
    }

    const resizeObserver = new ResizeObserver(updateTop)
    resizeObserver.observe(header)
    return () => {
      resizeObserver.disconnect()
      sidebar.style.removeProperty('--oanix-folder-grid-top')
    }
  }, [targets.header, targets.sidebar])

  useEffect(() => {
    const shell = targets.tabsShell
    if (!shell) return

    if (!gridOpen && !targets.searchOpen) shell.dataset.oanixFolderCompact = 'true'
    else delete shell.dataset.oanixFolderCompact

    return () => {
      delete shell.dataset.oanixFolderCompact
    }
  }, [gridOpen, targets.searchOpen, targets.tabsShell])

  useEffect(() => {
    document.documentElement.classList.toggle('oanix-folder-home-open', gridOpen)
    document.body?.classList.toggle('oanix-folder-home-open', gridOpen)
    return () => {
      document.documentElement.classList.remove('oanix-folder-home-open')
      document.body?.classList.remove('oanix-folder-home-open')
    }
  }, [gridOpen])

  useEffect(() => {
    function scheduleRefresh() {
      if (!gridOpenRef.current || reorderMode) return
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        void refreshData()
      }, 180)
    }

    window.addEventListener('oanix:local-data-changed', scheduleRefresh)
    return () => {
      window.removeEventListener('oanix:local-data-changed', scheduleRefresh)
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
    }
  }, [reorderMode])

  useEffect(() => {
    if (gridOpen) void refreshData()
  }, [gridOpen])

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
  }, [])

  const dashboardVisible = gridOpen && !targets.searchOpen && Boolean(targets.sidebar && targets.tabsShell)

  const folderCards = useMemo(
    () => data.folders.map((folder, index) => ({
      ...folder,
      noteCount: data.counts.get(folder.id) ?? 0,
      cover: data.covers.get(folder.id) ?? '',
      shape: FOLDER_SHAPES[index % FOLDER_SHAPES.length],
      color: data.colors.get(folder.id) ?? '#111b31',
    })),
    [data.colors, data.counts, data.covers, data.folders],
  )

  const selectedFolder = useMemo(
    () => selectedFolderId === 'all'
      ? null
      : folderCards.find((folder) => folder.id === selectedFolderId) ?? null,
    [folderCards, selectedFolderId],
  )

  const panelSearchResults = useMemo(() => {
    const query = panelSearch.trim().toLocaleLowerCase()
    if (!query) return []
    return data.notes
      .filter((note) => selectedFolderId === 'all' || note.folderId === selectedFolderId)
      .filter((note) => {
        const haystack = `${note.title}\n${noteBlocksToPlainText(note.content.blocks)}`.toLocaleLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 6)
  }, [data.notes, panelSearch, selectedFolderId])

  const selectedCount = selectedFolder ? selectedFolder.noteCount : data.allCount
  const selectedCover = selectedFolder?.cover ?? ''

  function selectAllNotes() {
    if (reorderMode) return
    setSelectedFolderId('all')
    setPanelSearch('')
    window.dispatchEvent(new CustomEvent('oanix:select-workspace-folder', { detail: { folderId: 'all' } }))
  }

  function selectFolder(folder: FolderRecord) {
    if (reorderMode || suppressFolderSelectRef.current === folder.id) {
      suppressFolderSelectRef.current = null
      return
    }
    setSelectedFolderId(folder.id)
    setPanelSearch('')
    window.dispatchEvent(new CustomEvent('oanix:select-workspace-folder', { detail: { folderId: folder.id } }))
  }

  function openAllNotes() {
    if (reorderMode) return
    const button = visibleFolderTabButtons(targets.tabsShell)[0]
    if (!button) return
    setGridOpen(false)
    button.click()
  }

  function openFolder(folder: FolderRecord) {
    if (reorderMode) return
    const button = visibleFolderTabButtons(targets.tabsShell)
      .find((candidate) => candidate.textContent?.trim() === folder.name)
    if (!button) {
      setError('No se pudo abrir esta carpeta. Inténtalo de nuevo.')
      return
    }

    setGridOpen(false)
    button.click()
  }

  function openSelected() {
    if (selectedFolder) openFolder(selectedFolder)
    else openAllNotes()
  }

  function openSearchResult(note: NoteRecord) {
    if (selectedFolder) openFolder(selectedFolder)
    else openAllNotes()
    scheduleNoteOpen(note.id)
  }

  function openFolderManager() {
    const button = targets.tabsShell?.querySelector<HTMLButtonElement>('.notes-tab--add')
    button?.click()
  }

  function clearLongPress() {
    if (longPressTimerRef.current === null) return
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  function beginDragAt(
    folder: FolderRecord,
    button: HTMLButtonElement,
    pointerId: number,
    clientX: number,
    clientY: number,
  ) {
    const rect = button.getBoundingClientRect()
    suppressFolderSelectRef.current = folder.id
    dragStartOrderRef.current = data.folders.map((item) => item.id)
    setDraggingFolderId(folder.id)
    setDragGhost({
      folderId: folder.id,
      name: folder.name,
      noteCount: data.counts.get(folder.id) ?? 0,
      cover: data.covers.get(folder.id) ?? '',
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      offsetX: Math.max(0, Math.min(rect.width, clientX - rect.left)),
      offsetY: Math.max(0, Math.min(rect.height, clientY - rect.top)),
    })
    try {
      button.setPointerCapture(pointerId)
    } catch {
      // Pointer capture is best-effort.
    }
  }

  function queueFolderOrderPersistence(nextOrder: string[]) {
    pendingFolderOrderRef.current = [...nextOrder]
    if (folderOrderPersistingRef.current) return

    folderOrderPersistingRef.current = true
    setOrderingBusy(true)
    void (async () => {
      try {
        while (pendingFolderOrderRef.current) {
          const orderToPersist = pendingFolderOrderRef.current
          pendingFolderOrderRef.current = null
          try {
            const persisted = await persistFolderOrder(orderToPersist)
            if (pendingFolderOrderRef.current) continue
            setData((current) => {
              const currentIds = current.folders.map((folder) => folder.id)
              const stillMatchesPersistedOrder = currentIds.length === orderToPersist.length
                && currentIds.every((id, index) => id === orderToPersist[index])
              return stillMatchesPersistedOrder ? { ...current, folders: persisted } : current
            })
          } catch {
            setError('No se pudo guardar el nuevo orden de las carpetas.')
            if (!pendingFolderOrderRef.current) void refreshData()
          }
        }
      } finally {
        folderOrderPersistingRef.current = false
        setOrderingBusy(false)
        if (pendingFolderOrderRef.current) queueFolderOrderPersistence(pendingFolderOrderRef.current)
      }
    })()
  }

  function beginFolderPointerDown(folder: FolderRecord, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || customBusy) return
    clearLongPress()

    if (reorderMode) {
      event.preventDefault()
      beginDragAt(folder, event.currentTarget, event.pointerId, event.clientX, event.clientY)
      return
    }

    const button = event.currentTarget
    const pointerId = event.pointerId
    const clientX = event.clientX
    const clientY = event.clientY
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      setReorderMode(true)
      beginDragAt(folder, button, pointerId, clientX, clientY)
      if ('vibrate' in navigator) navigator.vibrate?.(18)
    }, FOLDER_LONG_PRESS_MS)
  }

  function handleFolderPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingFolderId) return
    event.preventDefault()
    setDragGhost((current) => current
      ? {
          ...current,
          left: event.clientX - current.offsetX,
          top: event.clientY - current.offsetY,
        }
      : current)

    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('.oanix-folder-rail__item[data-oanix-folder-id]')
    const targetId = target?.dataset.oanixFolderId
    if (!targetId || targetId === draggingFolderId || !target) return

    const rect = target.getBoundingClientRect()
    const placeAfter = event.clientX > rect.left + rect.width / 2
    const beforeRects = captureFolderRects()

    setData((current) => {
      const nextFolders = moveFolderAroundTarget(current.folders, draggingFolderId, targetId, placeAfter)
      if (nextFolders.every((folder, index) => folder.id === current.folders[index]?.id)) return current
      animateFolderReflow(beforeRects, draggingFolderId)
      return { ...current, folders: nextFolders }
    })
  }

  function finishFolderDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    clearLongPress()
    const folderId = draggingFolderId
    if (!folderId) return
    suppressFolderSelectRef.current = folderId
    setDraggingFolderId(null)
    setDragGhost(null)

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // No-op when capture was not available.
    }

    const startIndex = dragStartOrderRef.current.indexOf(folderId)
    const finalIndex = data.folders.findIndex((folder) => folder.id === folderId)
    if (startIndex < 0 || finalIndex < 0 || startIndex === finalIndex) return

    queueFolderOrderPersistence(data.folders.map((folder) => folder.id))
  }

  function cancelFolderGesture() {
    clearLongPress()
    if (!draggingFolderId) return
    setDraggingFolderId(null)
    setDragGhost(null)
    const startOrder = dragStartOrderRef.current
    setData((current) => {
      const rank = new Map(startOrder.map((id, index) => [id, index]))
      return {
        ...current,
        folders: [...current.folders].sort((left, right) => (rank.get(left.id) ?? 9999) - (rank.get(right.id) ?? 9999)),
      }
    })
  }

  function finishReorderMode() {
    clearLongPress()
    setDraggingFolderId(null)
    setDragGhost(null)
    setReorderMode(false)
    suppressFolderSelectRef.current = null
  }

  function openCustomizer(folder: FolderRecord) {
    if (reorderMode || customBusy) return
    setCustomError('')
    setCustomFolder(folder)
  }

  async function handleCoverFile(file: File | null) {
    if (!customFolder || !file || customBusy) return
    setCustomBusy(true)
    setCustomError('')

    try {
      const dataUrl = await prepareFolderCover(file)
      await saveFolderCover(customFolder.id, dataUrl)
      setData((current) => {
        const covers = new Map(current.covers)
        covers.set(customFolder.id, dataUrl)
        return { ...current, covers }
      })
      setCustomFolder(null)
    } catch (coverError) {
      setCustomError(coverError instanceof Error ? coverError.message : 'No se pudo guardar la imagen.')
    } finally {
      if (coverInputRef.current) coverInputRef.current.value = ''
      setCustomBusy(false)
    }
  }

  async function handleRemoveCover() {
    if (!customFolder || customBusy) return
    setCustomBusy(true)
    setCustomError('')

    try {
      await removeFolderCover(customFolder.id)
      setData((current) => {
        const covers = new Map(current.covers)
        covers.delete(customFolder.id)
        return { ...current, covers }
      })
      setCustomFolder(null)
    } catch {
      setCustomError('No se pudo quitar la imagen.')
    } finally {
      setCustomBusy(false)
    }
  }

  const customizerCover = customFolder ? data.covers.get(customFolder.id) ?? '' : ''

  return (
    <>
      {dashboardVisible && createPortal(
        <section
          className={`oanix-folder-grid${reorderMode ? ' oanix-folder-grid--reordering' : ''}${draggingFolderId ? ' oanix-folder-grid--drag-active' : ''}`}
          aria-label="Inicio de carpetas"
        >
          {loading && data.folders.length === 0 ? (
            <div className="oanix-folder-grid__empty">Cargando carpetas…</div>
          ) : (
            <div className="oanix-folder-stage">
              <aside className="oanix-folder-rail" aria-label="Selector de carpetas">
                <div className="oanix-folder-rail__scroll">
                  <button
                    className={`oanix-folder-rail__item oanix-folder-rail__item--all${selectedFolderId === 'all' ? ' is-selected' : ''}`}
                    type="button"
                    onClick={selectAllNotes}
                    disabled={reorderMode}
                    aria-label="Seleccionar Todas las notas"
                    title="Todas las notas"
                  >
                    <span className="oanix-folder-rail__shape"><span>▦</span></span>
                    <small>{data.allCount}</small>
                  </button>

                  {folderCards.map((folder) => (
                    <button
                      className={`oanix-folder-rail__item oanix-folder-rail__item--${folder.shape}${selectedFolderId === folder.id ? ' is-selected' : ''}${draggingFolderId === folder.id ? ' is-dragging' : ''}`}
                      type="button"
                      key={folder.id}
                      data-oanix-folder-id={folder.id}
                      style={{ '--oanix-folder-color': folder.color } as CSSProperties}
                      onClick={() => selectFolder(folder)}
                      onPointerDown={(event) => beginFolderPointerDown(folder, event)}
                      onPointerMove={handleFolderPointerMove}
                      onPointerUp={finishFolderDrag}
                      onPointerCancel={cancelFolderGesture}
                      onContextMenu={(event) => event.preventDefault()}
                      aria-label={reorderMode ? `Mover carpeta ${folder.name}` : `Seleccionar carpeta ${folder.name}`}
                      title={reorderMode ? 'Arrastra para cambiar de lugar' : folder.name}
                    >
                      <span className="oanix-folder-rail__shape">
                        {folder.cover
                          ? <img src={folder.cover} alt="" draggable={false} />
                          : <span className="oanix-folder-rail__folder-mark">⌑</span>}
                      </span>
                      {folder.noteCount > 0 && <small>{folder.noteCount}</small>}
                    </button>
                  ))}

                  <button
                    className="oanix-folder-rail__item oanix-folder-rail__item--add"
                    type="button"
                    onClick={openFolderManager}
                    disabled={reorderMode}
                    aria-label="Crear o administrar carpetas"
                    title="Nueva carpeta"
                  >
                    <span className="oanix-folder-rail__shape"><span>＋</span></span>
                  </button>
                </div>

                {reorderMode && (
                  <button className="oanix-folder-rail__done" type="button" onClick={finishReorderMode}>
                    {orderingBusy ? '…' : '✓'}
                  </button>
                )}
              </aside>

              <section
                className={`oanix-folder-focus${selectedCover ? ' oanix-folder-focus--covered' : ''}`}
                data-oanix-folder-id={selectedFolder?.id}
                style={{ '--oanix-folder-color': selectedFolder?.color ?? '#182849' } as CSSProperties}
                aria-label={selectedFolder ? `Vista de ${selectedFolder.name}` : 'Vista de Todas las notas'}
              >
                {selectedCover && (
                  <div
                    className="oanix-folder-focus__cover"
                    style={{ backgroundImage: `url("${selectedCover.replace(/"/g, '\\"')}")` }}
                    aria-hidden="true"
                  />
                )}
                <div className="oanix-folder-focus__color" aria-hidden="true" />
                <div className="oanix-folder-focus__ornament" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="oanix-folder-focus__topbar">
                  <label className="oanix-folder-focus__search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={panelSearch}
                      onChange={(event) => setPanelSearch(event.target.value)}
                      placeholder={selectedFolder ? `Buscar en ${selectedFolder.name}` : 'Buscar en todas las notas'}
                      aria-label={selectedFolder ? `Buscar notas dentro de ${selectedFolder.name}` : 'Buscar en todas las notas'}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {panelSearch && (
                      <button type="button" onClick={() => setPanelSearch('')} aria-label="Limpiar búsqueda">×</button>
                    )}
                  </label>
                  {selectedFolder && (
                    <button
                      className="oanix-folder-focus__menu"
                      type="button"
                      onClick={() => openCustomizer(selectedFolder)}
                      aria-label={`Personalizar ${selectedFolder.name}`}
                      title="Personalizar carpeta"
                    >
                      ⋮
                    </button>
                  )}
                </div>

                {panelSearch.trim() && (
                  <div className="oanix-folder-focus__results" role="listbox" aria-label="Resultados de búsqueda de notas">
                    {panelSearchResults.length > 0 ? panelSearchResults.map((note) => (
                      <button key={note.id} type="button" onClick={() => openSearchResult(note)}>
                        <strong>{note.title}</strong>
                        <small>Abrir nota</small>
                      </button>
                    )) : (
                      <div className="oanix-folder-focus__no-results">Sin coincidencias en esta carpeta.</div>
                    )}
                  </div>
                )}

                <div className="oanix-folder-focus__details" key={selectedFolderId}>
                  <span className="oanix-folder-focus__eyebrow">
                    {selectedFolder ? 'CARPETA' : 'BÓVEDA'}
                  </span>
                  <h2 title={selectedFolder?.name ?? 'Todas las notas'}>
                    {selectedFolder?.name ?? 'Todas las notas'}
                  </h2>
                  <p>
                    {selectedFolder
                      ? 'Tu espacio visual para organizar y abrir las notas de esta carpeta.'
                      : 'Acceso a todas las notas visibles de tu bóveda.'}
                  </p>
                  <div className="oanix-folder-focus__meta">
                    <span><small>NOTAS</small><strong>{selectedCount}</strong></span>
                    <span><small>PORTADA</small><strong>{selectedCover ? 'Sí' : 'No'}</strong></span>
                  </div>

                  <div className="oanix-folder-focus__actions">
                    <button className="oanix-folder-focus__open" type="button" onClick={openSelected} disabled={reorderMode}>
                      <span aria-hidden="true">↗</span>
                      <span>Abrir</span>
                    </button>
                    {selectedFolder && (
                      <>
                        <button type="button" data-oanix-folder-customize="true" onClick={() => openCustomizer(selectedFolder)} disabled={reorderMode}>
                          <span aria-hidden="true">▧</span>
                          <span>Imagen</span>
                        </button>
                        <button type="button" data-oanix-folder-customize="true" onClick={() => openCustomizer(selectedFolder)} disabled={reorderMode}>
                          <span aria-hidden="true">◐</span>
                          <span>Color</span>
                        </button>
                        <button type="button" onClick={openFolderManager} disabled={reorderMode}>
                          <span aria-hidden="true">✎</span>
                          <span>Nombre</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="oanix-folder-focus__hint">
                  {reorderMode ? 'Arrastra los iconos de la izquierda y toca ✓ al terminar.' : 'Desliza el selector lateral · mantén presionado para ordenar.'}
                </div>
              </section>
            </div>
          )}

          {data.folders.length === 0 && !loading && !error && (
            <p className="oanix-folder-grid__hint">Crea tu primera carpeta con el botón ＋.</p>
          )}
          {error && <p className="oanix-folder-grid__error" role="alert">{error}</p>}
        </section>,
        document.body,
      )}

      {dragGhost && createPortal(
        <div
          className="oanix-folder-drag-ghost"
          aria-hidden="true"
          style={{
            left: `${dragGhost.left}px`,
            top: `${dragGhost.top}px`,
            width: `${dragGhost.width}px`,
            minHeight: `${dragGhost.height}px`,
          }}
        >
          <span className="oanix-folder-drag-ghost__visual">
            {dragGhost.cover
              ? <img src={dragGhost.cover} alt="" draggable={false} />
              : <span className="oanix-folder-rail__folder-mark">⌑</span>}
          </span>
          <strong>{dragGhost.name}</strong>
          <small>{dragGhost.noteCount}</small>
        </div>,
        document.body,
      )}

      {!gridOpen && !targets.searchOpen && targets.tabsShell && createPortal(
        <div className="oanix-folder-breadcrumb">
          <button type="button" onClick={() => setGridOpen(true)} aria-label="Volver a carpetas" data-oanix-folder-home-back="true">
            ‹ <span>Carpetas</span>
          </button>
          <strong title={targets.activeLabel}>{targets.activeLabel === 'Todas' ? 'Todas las notas' : targets.activeLabel}</strong>
        </div>,
        targets.tabsShell,
      )}

      {customFolder && createPortal(
        <div
          className="oanix-folder-customizer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="oanix-folder-customizer-title"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && !customBusy) setCustomFolder(null)
          }}
        >
          <section
            className="oanix-folder-customizer"
            data-oanix-folder-id={customFolder.id}
            style={{ '--oanix-folder-color': data.colors.get(customFolder.id) ?? '#111b31' } as CSSProperties}
          >
            <div className="oanix-folder-customizer__preview" aria-hidden="true">
              {customizerCover ? <img src={customizerCover} alt="" /> : <span>📁</span>}
            </div>
            <div className="oanix-folder-customizer__body">
              <span>OPCIONES DE CARPETA</span>
              <strong id="oanix-folder-customizer-title">{customFolder.name}</strong>
              <p>Imagen, color e icono se mantienen cifrados en la configuración local de esta carpeta.</p>
              {customError && <div className="oanix-folder-customizer__error" role="alert">{customError}</div>}
              <div className="oanix-folder-customizer__actions">
                <button type="button" onClick={() => coverInputRef.current?.click()} disabled={customBusy}>
                  {customBusy ? 'Guardando…' : customizerCover ? 'Cambiar imagen' : 'Poner imagen'}
                </button>
                {customizerCover && (
                  <button className="oanix-folder-customizer__remove" type="button" onClick={() => void handleRemoveCover()} disabled={customBusy}>
                    Quitar imagen
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCustomFolder(null)
                    openFolderManager()
                  }}
                  disabled={customBusy}
                >
                  Administrar nombre / eliminar
                </button>
                <button type="button" onClick={() => setCustomFolder(null)} disabled={customBusy}>Cancelar</button>
              </div>
              <input
                ref={coverInputRef}
                className="oanix-folder-customizer__input"
                type="file"
                accept="image/*"
                onChange={(event) => void handleCoverFile(event.currentTarget.files?.[0] ?? null)}
              />
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
