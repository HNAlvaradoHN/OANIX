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
import { loadFolders } from './folderService'
import type { FolderRecord } from './folderTypes'
import './folderGrid.css'

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

const FOLDER_LONG_PRESS_MS = 520

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

export function FolderGridRuntime() {
  const [targets, setTargets] = useState<FolderGridTargets>(() => currentTargets())
  const [gridOpen, setGridOpen] = useState(true)
  const [data, setData] = useState<FolderGridData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [customFolder, setCustomFolder] = useState<FolderRecord | null>(null)
  const [customBusy, setCustomBusy] = useState(false)
  const [customError, setCustomError] = useState('')
  const gridOpenRef = useRef(gridOpen)
  const refreshTimerRef = useRef<number | null>(null)
  const refreshRequestRef = useRef(0)
  const longPressTimerRef = useRef<number | null>(null)
  const suppressFolderOpenRef = useRef<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

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
      if (!gridOpenRef.current) return
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
  }, [])

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
    const button = visibleFolderTabButtons(targets.tabsShell)[0]
    if (!button) return
    setGridOpen(false)
    button.click()
  }

  function openFolder(folder: FolderRecord) {
    if (suppressFolderOpenRef.current === folder.id) {
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

  function beginFolderLongPress(folder: FolderRecord, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || customBusy) return
    clearLongPress()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      suppressFolderOpenRef.current = folder.id
      setCustomError('')
      setCustomFolder(folder)
      if ('vibrate' in navigator) navigator.vibrate?.(22)
    }, FOLDER_LONG_PRESS_MS)
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
        <section className="oanix-folder-grid" aria-label="Inicio de carpetas">
          <div className="oanix-folder-grid__header">
            <div>
              <span>ORGANIZA TU ESPACIO</span>
              <strong>Carpetas</strong>
            </div>
            <small>{data.folders.length} carpeta{data.folders.length === 1 ? '' : 's'}</small>
          </div>

          {loading && data.folders.length === 0 ? (
            <div className="oanix-folder-grid__empty">Cargando carpetas…</div>
          ) : (
            <div className="oanix-folder-grid__cards">
              <button className="oanix-folder-card oanix-folder-card--all" type="button" onClick={openAllNotes}>
                <span className="oanix-folder-card__visual oanix-folder-card__visual--all" aria-hidden="true">▦</span>
                <strong>Todas las notas</strong>
                <small>{data.allCount} nota{data.allCount === 1 ? '' : 's'}</small>
              </button>

              {folderCards.map((folder, index) => (
                <button
                  className={`oanix-folder-card${folder.cover ? ' oanix-folder-card--covered' : ''}`}
                  type="button"
                  key={folder.id}
                  onClick={() => openFolder(folder)}
                  onPointerDown={(event) => beginFolderLongPress(folder, event)}
                  onPointerUp={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onContextMenu={(event) => event.preventDefault()}
                  title={`${folder.name} · Mantén presionado para personalizar`}
                  style={{ '--oanix-folder-index': index } as React.CSSProperties}
                >
                  <span className="oanix-folder-card__visual" aria-hidden="true">
                    {folder.cover
                      ? <img src={folder.cover} alt="" draggable={false} />
                      : <span className="oanix-folder-card__folder-mark">⌑</span>}
                  </span>
                  <strong>{folder.name}</strong>
                  <small>{folder.noteCount} nota{folder.noteCount === 1 ? '' : 's'}</small>
                </button>
              ))}

              <button className="oanix-folder-card oanix-folder-card--add" type="button" onClick={openFolderManager}>
                <span className="oanix-folder-card__visual oanix-folder-card__visual--add" aria-hidden="true">＋</span>
                <strong>Nueva carpeta</strong>
                <small>Agregar</small>
              </button>
            </div>
          )}

          {data.folders.length > 0 && !loading && (
            <p className="oanix-folder-grid__gesture-hint">Mantén presionada una carpeta para ponerle una imagen.</p>
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
              <p>Usaremos una miniatura pequeña y cifrada. Tus notas no se modifican.</p>
              {customError && <div className="oanix-folder-customizer__error" role="alert">{customError}</div>}
              <div className="oanix-folder-customizer__actions">
                <button type="button" onClick={() => coverInputRef.current?.click()} disabled={customBusy}>
                  {customBusy ? 'Guardando…' : 'Elegir imagen'}
                </button>
                {selectedCover && (
                  <button className="oanix-folder-customizer__remove" type="button" onClick={() => void handleRemoveCover()} disabled={customBusy}>
                    Quitar imagen
                  </button>
                )}
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
