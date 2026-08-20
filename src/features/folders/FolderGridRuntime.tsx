import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes } from '../notes/noteService'
import { listNotePrivacy } from '../privacy/notePrivacyService'
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
}

const EMPTY_DATA: FolderGridData = {
  folders: [],
  allCount: 0,
  counts: new Map(),
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
  const gridOpenRef = useRef(gridOpen)
  const refreshTimerRef = useRef<number | null>(null)
  const refreshRequestRef = useRef(0)

  useEffect(() => {
    gridOpenRef.current = gridOpen
  }, [gridOpen])

  async function refreshData() {
    const request = ++refreshRequestRef.current
    setLoading(true)
    setError('')

    try {
      const [folders, notes, privacy] = await Promise.all([
        loadFolders(),
        loadNotes(),
        listNotePrivacy(),
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

      setData({ folders, allCount: visibleNotes.length, counts })
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

    return () => delete shell.dataset.oanixFolderCompact
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

  const dashboardVisible = gridOpen && !targets.searchOpen && Boolean(targets.sidebar)

  const folderCards = useMemo(
    () => data.folders.map((folder) => ({
      ...folder,
      noteCount: data.counts.get(folder.id) ?? 0,
    })),
    [data.counts, data.folders],
  )

  function openAllNotes() {
    const button = visibleFolderTabButtons(targets.tabsShell)[0]
    if (!button) return
    setGridOpen(false)
    button.click()
  }

  function openFolder(folder: FolderRecord) {
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
                <span className="oanix-folder-card__icon" aria-hidden="true">▦</span>
                <strong>Todas las notas</strong>
                <small>{data.allCount}</small>
              </button>

              {folderCards.map((folder) => (
                <button
                  className="oanix-folder-card"
                  type="button"
                  key={folder.id}
                  onClick={() => openFolder(folder)}
                  title={folder.name}
                >
                  <span className="oanix-folder-card__icon" aria-hidden="true">📁</span>
                  <strong>{folder.name}</strong>
                  <small>{folder.noteCount}</small>
                </button>
              ))}

              <button className="oanix-folder-card oanix-folder-card--add" type="button" onClick={openFolderManager}>
                <span className="oanix-folder-card__icon" aria-hidden="true">＋</span>
                <strong>Nueva carpeta</strong>
                <small>Agregar</small>
              </button>
            </div>
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
          <button type="button" onClick={() => setGridOpen(true)} aria-label="Volver a carpetas">
            ‹ <span>Carpetas</span>
          </button>
          <strong title={targets.activeLabel}>{targets.activeLabel === 'Todas' ? 'Todas las notas' : targets.activeLabel}</strong>
        </div>,
        targets.tabsShell,
      )}
    </>
  )
}
