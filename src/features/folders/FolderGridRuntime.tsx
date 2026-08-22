import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes } from '../notes/noteService'
import { listNotePrivacy } from '../privacy/notePrivacyService'
import {
  loadFolderCovers,
  prepareFolderCover,
  removeFolderCover,
  saveFolderCover,
} from './folderCoverService'
import { loadFolders, reorderFolder } from './folderService'
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
}

const EMPTY_DATA: FolderGridData = {
  folders: [],
  allCount: 0,
  counts: new Map(),
  covers: new Map(),
}

const FOLDER_LONG_PRESS_MS = 460

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

function moveFolderBeforeTarget(folders: FolderRecord[], draggedId: string, targetId: string): FolderRecord[] {
  if (draggedId === targetId) return folders
  const fromIndex = folders.findIndex((folder) => folder.id === draggedId)
  const targetIndex = folders.findIndex((folder) => folder.id === targetId)
  if (fromIndex < 0 || targetIndex < 0) return folders

  const next = [...folders]
  const [dragged] = next.splice(fromIndex, 1)
  const insertionIndex = next.findIndex((folder) => folder.id === targetId)
  next.splice(insertionIndex < 0 ? next.length : insertionIndex, 0, dragged)
  return next
}

export function FolderGridRuntime() {
  const [targets, setTargets] = useState<FolderGridTargets>(() => currentTargets())
  const [gridOpen, setGridOpen] = useState(true)
  const [data, setData] = useState<FolderGridData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customFolder, setCustomFolder] = useState<FolderRecord | null>(null)
  const [customBusy, setCustomBusy] = useState(false)
  const [customError, setCustomError] = useState('')
  const [reorderMode, setReorderMode] = useState(false)
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null)
  const [orderingBusy, setOrderingBusy] = useState(false)
  const gridOpenRef = useRef(gridOpen)
  const refreshTimerRef = useRef<number | null>(null)
  const refreshRequestRef = useRef(0)
  const longPressTimerRef = useRef<number | null>(null)
  const suppressFolderOpenRef = useRef<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const dragStartOrderRef = useRef<string[]>([])

  useEffect(() => {
    gridOpenRef.current = gridOpen
  }, [gridOpen])

  async function refreshData() {
    const request = ++refreshRequestRef.current
    setLoading(true)
    setError('')

    try {
      const [folders, notes, privacy, covers] = await Promise.all([
        loadFolders(),
        loadNotes(),
        listNotePrivacy(),
        loadFolderCovers(),
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

      setData({ folders, allCount: visibleNotes.length, counts, covers })
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
    const observer = new MutationObserver(refreshTargets)
    observer.observe(document.body, {
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
    () => data.folders.map((folder) => ({
      ...folder,
      noteCount: data.counts.get(folder.id) ?? 0,
      cover: data.covers.get(folder.id) ?? '',
    })),
    [data.counts, data.covers, data.folders],
  )

  function openAllNotes() {
    if (reorderMode) return
    const button = visibleFolderTabButtons(targets.tabsShell)[0]
    if (!button) return
    setGridOpen(false)
    button.click()
  }

  function openFolder(folder: FolderRecord) {
    if (reorderMode || suppressFolderOpenRef.current === folder.id) {
      suppressFolderOpenRef.current = null
      return
    }

    const button = visibleFolderTabButtons(targets.tabsShell)
      .find((candidate) => candidate.textContent?.trim() === folder.name)
    if (!button) {
      setError('No se pudo abrir esta carpeta. Inténtalo de nuevo.')
      return
    }

    setGridOpen(false)
    button.click()
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

  function startFolderDrag(folder: FolderRecord, event: ReactPointerEvent<HTMLButtonElement>) {
    suppressFolderOpenRef.current = folder.id
    dragStartOrderRef.current = data.folders.map((item) => item.id)
    setDraggingFolderId(folder.id)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is best-effort; desktop mouse still works without it.
    }
  }

  function beginFolderPointerDown(folder: FolderRecord, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || customBusy || orderingBusy) return
    clearLongPress()

    if (reorderMode) {
      event.preventDefault()
      startFolderDrag(folder, event)
      return
    }

    const button = event.currentTarget
    const pointerId = event.pointerId
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      suppressFolderOpenRef.current = folder.id
      dragStartOrderRef.current = data.folders.map((item) => item.id)
      setReorderMode(true)
      setDraggingFolderId(folder.id)
      try {
        button.setPointerCapture(pointerId)
      } catch {
        // See startFolderDrag.
      }
      if ('vibrate' in navigator) navigator.vibrate?.(18)
    }, FOLDER_LONG_PRESS_MS)
  }

  function handleFolderPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingFolderId) return
    event.preventDefault()
    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-oanix-folder-id]')
    const targetId = target?.dataset.oanixFolderId
    if (!targetId || targetId === draggingFolderId) return

    setData((current) => ({
      ...current,
      folders: moveFolderBeforeTarget(current.folders, draggingFolderId, targetId),
    }))
  }

  async function finishFolderDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    clearLongPress()
    const folderId = draggingFolderId
    if (!folderId) return
    suppressFolderOpenRef.current = folderId
    setDraggingFolderId(null)

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

    setOrderingBusy(true)
    try {
      const direction = finalIndex < startIndex ? 'up' : 'down'
      let remaining = Math.abs(finalIndex - startIndex)
      let nextFolders = await loadFolders()
      while (remaining > 0) {
        nextFolders = await reorderFolder(folderId, direction)
        remaining -= 1
      }
      setData((current) => ({ ...current, folders: nextFolders }))
    } catch {
      setError('No se pudo guardar el nuevo orden de las carpetas.')
      await refreshData()
    } finally {
      setOrderingBusy(false)
    }
  }

  function cancelFolderGesture() {
    clearLongPress()
    if (!draggingFolderId) return
    setDraggingFolderId(null)
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
    setReorderMode(false)
    suppressFolderOpenRef.current = null
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

  const selectedCover = customFolder ? data.covers.get(customFolder.id) ?? '' : ''

  return (
    <>
      {dashboardVisible && targets.sidebar && createPortal(
        <section className={`oanix-folder-grid${reorderMode ? ' oanix-folder-grid--reordering' : ''}`} aria-label="Inicio de carpetas">
          <div className="oanix-folder-grid__header">
            <div>
              <span>{reorderMode ? 'ORDENA A TU GUSTO' : 'ORGANIZA TU ESPACIO'}</span>
              <strong>Carpetas</strong>
            </div>
            {reorderMode ? (
              <button className="oanix-folder-grid__done" type="button" onClick={finishReorderMode} disabled={orderingBusy}>
                {orderingBusy ? 'Guardando…' : 'Listo'}
              </button>
            ) : (
              <small>{data.folders.length} carpeta{data.folders.length === 1 ? '' : 's'}</small>
            )}
          </div>

          {loading && data.folders.length === 0 ? (
            <div className="oanix-folder-grid__empty">Cargando carpetas…</div>
          ) : (
            <div className="oanix-folder-grid__cards">
              <button className="oanix-folder-card oanix-folder-card--all" type="button" onClick={openAllNotes} disabled={reorderMode}>
                <span className="oanix-folder-card__visual oanix-folder-card__visual--all" aria-hidden="true">▦</span>
                <strong>Todas las notas</strong>
                <small>{data.allCount} nota{data.allCount === 1 ? '' : 's'}</small>
              </button>

              {folderCards.map((folder, index) => (
                <article
                  className={`oanix-folder-card oanix-folder-card--custom${folder.cover ? ' oanix-folder-card--covered' : ''}${draggingFolderId === folder.id ? ' oanix-folder-card--dragging' : ''}`}
                  key={folder.id}
                  data-oanix-folder-id={folder.id}
                  style={{ '--oanix-folder-index': index } as React.CSSProperties}
                >
                  <button
                    className="oanix-folder-card__open"
                    type="button"
                    onClick={() => openFolder(folder)}
                    onPointerDown={(event) => beginFolderPointerDown(folder, event)}
                    onPointerMove={handleFolderPointerMove}
                    onPointerUp={(event) => void finishFolderDrag(event)}
                    onPointerCancel={cancelFolderGesture}
                    onContextMenu={(event) => event.preventDefault()}
                    aria-label={reorderMode ? `Mover carpeta ${folder.name}` : `Abrir carpeta ${folder.name}`}
                    title={reorderMode ? 'Arrastra para cambiar de lugar' : `${folder.name} · Mantén presionado para ordenar`}
                  >
                    <span className="oanix-folder-card__visual" aria-hidden="true">
                      {folder.cover
                        ? <img src={folder.cover} alt="" draggable={false} />
                        : <span className="oanix-folder-card__folder-mark">⌑</span>}
                    </span>
                    <strong>{folder.name}</strong>
                    <small>{folder.noteCount} nota{folder.noteCount === 1 ? '' : 's'}</small>
                  </button>
                  <button
                    className="oanix-folder-card__menu"
                    type="button"
                    onClick={() => openCustomizer(folder)}
                    disabled={reorderMode || customBusy}
                    aria-label={`Personalizar ${folder.name}`}
                    title="Cambiar carpeta"
                  >
                    ⋮
                  </button>
                </article>
              ))}

              <button className="oanix-folder-card oanix-folder-card--add" type="button" onClick={openFolderManager} disabled={reorderMode}>
                <span className="oanix-folder-card__visual oanix-folder-card__visual--add" aria-hidden="true">＋</span>
                <strong>Nueva carpeta</strong>
                <small>Agregar</small>
              </button>
            </div>
          )}

          {data.folders.length > 0 && !loading && (
            <p className="oanix-folder-grid__gesture-hint">
              {reorderMode ? 'Arrastra las carpetas y toca “Listo” cuando termines.' : 'Mantén presionada una carpeta para ordenar · ⋮ para personalizar.'}
            </p>
          )}
          {data.folders.length === 0 && !loading && !error && (
            <p className="oanix-folder-grid__hint">Crea tu primera carpeta o entra a “Todas las notas”.</p>
          )}
          {error && <p className="oanix-folder-grid__error" role="alert">{error}</p>}
        </section>,
        targets.sidebar,
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
          <section className="oanix-folder-customizer">
            <div className="oanix-folder-customizer__preview" aria-hidden="true">
              {selectedCover ? <img src={selectedCover} alt="" /> : <span>⌑</span>}
            </div>
            <div className="oanix-folder-customizer__body">
              <span>PERSONALIZAR CARPETA</span>
              <strong id="oanix-folder-customizer-title">{customFolder.name}</strong>
              <p>La portada es una miniatura pequeña y cifrada. También puedes cambiar el nombre o eliminar la carpeta desde Administrar.</p>
              {customError && <div className="oanix-folder-customizer__error" role="alert">{customError}</div>}
              <div className="oanix-folder-customizer__actions">
                <button type="button" onClick={() => coverInputRef.current?.click()} disabled={customBusy}>
                  {customBusy ? 'Guardando…' : selectedCover ? 'Cambiar imagen' : 'Poner imagen'}
                </button>
                {selectedCover && (
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
