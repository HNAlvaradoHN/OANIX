import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes } from '../notes/noteService'
import { listNotePrivacy } from '../privacy/notePrivacyService'
import {
  loadFolderCovers,
  prepareFolderCover,
  removeFolderCover,
  saveFolderCover,
} from './folderCoverService'
import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  FOLDER_COLOR_PRESETS,
  FOLDER_DEFAULT_ICONS,
  FOLDER_ICON_OPTIONS,
  type FolderIcon,
} from './folderAppearanceCatalog'
import {
  loadFolderColors,
  loadFolderIcons,
  saveFolderColor,
  saveFolderIcon,
} from './folderAppearanceService'
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
  allCount: number
  counts: Map<string, number>
  covers: Map<string, string>
  colors: Map<string, string>
  icons: Map<string, FolderIcon>
}

interface FolderDragGhost {
  folderId: string
  name: string
  noteCount: number
  cover: string
  icon: FolderIcon
  left: number
  top: number
  width: number
  height: number
  offsetX: number
  offsetY: number
}

const EMPTY_DATA: FolderGridData = {
  folders: [],
  allCount: 0,
  counts: new Map(),
  covers: new Map(),
  colors: new Map(),
  icons: new Map(),
}

const FOLDER_LONG_PRESS_MS = 460
const FOLDER_SHAPES = ['blob-a', 'circle', 'squircle', 'blob-b', 'diamond', 'hexagon'] as const

function defaultIconForIndex(index: number): FolderIcon {
  return (FOLDER_DEFAULT_ICONS[index % FOLDER_DEFAULT_ICONS.length] ?? DEFAULT_FOLDER_ICON) as FolderIcon
}

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

export function FolderGridRuntime() {
  const [targets, setTargets] = useState<FolderGridTargets>(() => currentTargets())
  const [gridOpen, setGridOpen] = useState(true)
  const [data, setData] = useState<FolderGridData>(EMPTY_DATA)
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customFolder, setCustomFolder] = useState<FolderRecord | null>(null)
  const [customBusy, setCustomBusy] = useState(false)
  const [customError, setCustomError] = useState('')
  const [customAppearanceOpen, setCustomAppearanceOpen] = useState(false)
  const [customDraftColor, setCustomDraftColor] = useState(DEFAULT_FOLDER_COLOR)
  const [customDraftIcon, setCustomDraftIcon] = useState<FolderIcon>(DEFAULT_FOLDER_ICON)
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
  const foldersRef = useRef<FolderRecord[]>([])
  const dataRef = useRef(data)

  useEffect(() => {
    gridOpenRef.current = gridOpen
  }, [gridOpen])

  useEffect(() => {
    foldersRef.current = data.folders
    dataRef.current = data
  }, [data])

  useEffect(() => {
    const handleMobileOrderPreview = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { orderedIds?: unknown } | null
        : null
      if (!Array.isArray(detail?.orderedIds) || !detail.orderedIds.every((id) => typeof id === 'string')) return

      const orderedIds = detail.orderedIds as string[]
      const currentFolders = foldersRef.current
      if (orderedIds.length !== currentFolders.length) return
      const byId = new Map(currentFolders.map((folder) => [folder.id, folder]))
      if (orderedIds.some((id) => !byId.has(id))) return
      const nextFolders = orderedIds.map((id) => byId.get(id)!)
      if (nextFolders.every((folder, index) => folder.id === currentFolders[index]?.id)) return

      foldersRef.current = nextFolders
      setData((current) => ({ ...current, folders: nextFolders }))
      queueFolderOrderPersistence(orderedIds)
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

  useEffect(() => {
    const handleOpenCustomizer = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { folderId?: unknown } | null
        : null
      if (typeof detail?.folderId !== 'string') return
      const folder = foldersRef.current.find((candidate) => candidate.id === detail.folderId)
      if (!folder) return
      const current = dataRef.current
      const folderIndex = Math.max(0, current.folders.findIndex((candidate) => candidate.id === folder.id))
      setCustomDraftColor(current.colors.get(folder.id) ?? DEFAULT_FOLDER_COLOR)
      setCustomDraftIcon(current.icons.get(folder.id) ?? defaultIconForIndex(folderIndex))
      setCustomAppearanceOpen(false)
      setCustomError('')
      setCustomFolder(folder)
    }

    window.addEventListener('oanix:open-folder-customizer', handleOpenCustomizer)
    return () => window.removeEventListener('oanix:open-folder-customizer', handleOpenCustomizer)
  }, [])

  async function refreshData() {
    const request = ++refreshRequestRef.current
    setLoading(true)
    setError('')

    try {
      const [folders, notes, privacy, covers, colors, icons] = await Promise.all([
        loadFolders(),
        loadNotes(),
        listNotePrivacy(),
        loadFolderCovers(),
        loadFolderColors(),
        loadFolderIcons(),
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

      setData({ folders, allCount: visibleNotes.length, counts, covers, colors, icons })
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
      color: data.colors.get(folder.id) ?? DEFAULT_FOLDER_COLOR,
      icon: data.icons.get(folder.id) ?? defaultIconForIndex(index),
    })),
    [data.colors, data.counts, data.covers, data.folders, data.icons],
  )

  function selectAllNotes() {
    if (reorderMode) return
    setSelectedFolderId('all')
    window.dispatchEvent(new CustomEvent('oanix:select-workspace-folder', { detail: { folderId: 'all' } }))
  }

  function selectFolder(folder: FolderRecord) {
    if (reorderMode || suppressFolderSelectRef.current === folder.id) {
      suppressFolderSelectRef.current = null
      return
    }
    setSelectedFolderId(folder.id)
    window.dispatchEvent(new CustomEvent('oanix:select-workspace-folder', { detail: { folderId: folder.id } }))
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
      icon: data.icons.get(folder.id) ?? defaultIconForIndex(Math.max(0, data.folders.findIndex((item) => item.id === folder.id))),
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
    const current = dataRef.current
    const folderIndex = Math.max(0, current.folders.findIndex((candidate) => candidate.id === folder.id))
    setCustomDraftColor(current.colors.get(folder.id) ?? DEFAULT_FOLDER_COLOR)
    setCustomDraftIcon(current.icons.get(folder.id) ?? defaultIconForIndex(folderIndex))
    setCustomAppearanceOpen(false)
    setCustomError('')
    setCustomFolder(folder)
  }

  async function handleSaveAppearance() {
    if (!customFolder || customBusy) return
    const folderId = customFolder.id
    const color = customDraftColor
    const icon = customDraftIcon
    setCustomBusy(true)
    setCustomError('')
    try {
      await Promise.all([
        saveFolderColor(folderId, color),
        saveFolderIcon(folderId, icon),
      ])
      setData((current) => {
        const colors = new Map(current.colors)
        const icons = new Map(current.icons)
        colors.set(folderId, color)
        icons.set(folderId, icon)
        return { ...current, colors, icons }
      })
      window.dispatchEvent(new CustomEvent('oanix:folder-appearance-saved'))
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
        detail: { recordType: 'folder-appearance', recordId: folderId },
      }))
      setCustomFolder(null)
    } catch (appearanceError) {
      setCustomError(appearanceError instanceof Error ? appearanceError.message : 'No se pudo guardar el color o icono.')
    } finally {
      setCustomBusy(false)
    }
  }

  function openScopedManager() {
    if (!customFolder || customBusy) return
    const folder = customFolder
    setCustomFolder(null)
    window.dispatchEvent(new CustomEvent('oanix:open-folder-manager', {
      detail: { folderId: folder.id, folderName: folder.name },
    }))
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
                          : <span className="oanix-folder-rail__folder-mark">{folder.icon}</span>}
                      </span>
                      {folder.noteCount > 0 && <small>{folder.noteCount}</small>}
                      {!reorderMode && (
                        <span
                          className="oanix-folder-card__gear"
                          aria-hidden="true"
                          title="Opciones de carpeta"
                          onPointerDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                          }}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            openCustomizer(folder)
                          }}
                        >
                          ⚙
                        </span>
                      )}
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
              : <span className="oanix-folder-rail__folder-mark">{dragGhost.icon}</span>}
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
            style={{ '--oanix-folder-color': customDraftColor } as CSSProperties}
          >
            <div className="oanix-folder-customizer__preview" aria-hidden="true">
              {customizerCover ? <img src={customizerCover} alt="" /> : <span>{customDraftIcon}</span>}
            </div>
            <div className="oanix-folder-customizer__body">
              <span>OPCIONES DE CARPETA</span>
              <strong id="oanix-folder-customizer-title">{customFolder.name}</strong>
              <p>Imagen, color e icono se mantienen cifrados en la configuración local de esta carpeta.</p>
              {customError && <div className="oanix-folder-customizer__error" role="alert">{customError}</div>}
              {customAppearanceOpen && (
                <div className="oanix-folder-appearance-picker">
                  <section className="oanix-folder-appearance-section">
                    <div className="oanix-folder-appearance-picker__heading">
                      <strong>Color de carpeta</strong>
                      <small>Previsualiza el tono y guarda una sola vez al terminar.</small>
                    </div>
                    <div className="oanix-folder-appearance-picker__row">
                      {FOLDER_COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="oanix-folder-appearance-picker__swatch"
                          style={{ '--oanix-folder-swatch': color, backgroundColor: color } as CSSProperties}
                          data-selected={customDraftColor.toLowerCase() === color.toLowerCase() ? 'true' : undefined}
                          aria-label={`Usar color ${color}`}
                          onClick={() => setCustomDraftColor(color)}
                          disabled={customBusy}
                        />
                      ))}
                      <input
                        type="color"
                        className="oanix-folder-appearance-picker__custom"
                        value={customDraftColor}
                        aria-label="Elegir color personalizado"
                        onChange={(event) => setCustomDraftColor(event.target.value.toLowerCase())}
                        disabled={customBusy}
                      />
                    </div>
                  </section>

                  <section className="oanix-folder-appearance-section oanix-folder-appearance-section--icons">
                    <div className="oanix-folder-appearance-picker__heading">
                      <strong>Icono de carpeta</strong>
                      <small>Elige el icono y confirma junto con el color.</small>
                    </div>
                    <div className="oanix-folder-appearance-picker__icons">
                      {FOLDER_ICON_OPTIONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          className="oanix-folder-appearance-picker__icon"
                          data-selected={customDraftIcon === icon ? 'true' : undefined}
                          aria-label={`Usar icono ${icon}`}
                          onClick={() => setCustomDraftIcon(icon)}
                          disabled={customBusy}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </section>

                  <button
                    type="button"
                    className="oanix-folder-appearance-picker__save"
                    onClick={() => void handleSaveAppearance()}
                    disabled={customBusy}
                  >
                    {customBusy ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              )}

              <div className="oanix-folder-customizer__actions">
                <button
                  type="button"
                  className="oanix-folder-customizer__appearance-toggle"
                  aria-expanded={customAppearanceOpen}
                  onClick={() => setCustomAppearanceOpen((open) => !open)}
                  disabled={customBusy}
                >
                  🎨 Cambiar color / Icono
                </button>
                <button
                  type="button"
                  className="oanix-folder-customizer__image-action"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={customBusy}
                >
                  {customBusy ? 'Guardando…' : customizerCover ? '🖼️ Cambiar imagen de mi dispositivo' : '🖼️ Poner imagen desde mi dispositivo'}
                </button>
                {customizerCover && (
                  <button className="oanix-folder-customizer__remove" type="button" onClick={() => void handleRemoveCover()} disabled={customBusy}>
                    🧹 Quitar imagen
                  </button>
                )}
                <button type="button" onClick={openScopedManager} disabled={customBusy}>
                  ✏️ Administrar nombre / eliminar
                </button>
                <button
                  type="button"
                  className="oanix-folder-customizer__cancel-action"
                  onClick={() => setCustomFolder(null)}
                  disabled={customBusy}
                >
                  Cancelar
                </button>
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
