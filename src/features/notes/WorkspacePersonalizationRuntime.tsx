import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  loadFolderAppearanceFlags,
  type FolderAppearanceFlags,
} from '../folders/folderAppearanceService'
import { loadFolders } from '../folders/folderService'
import type { FolderRecord } from '../folders/folderTypes'
import { applyOanixTheme, readSavedOanixTheme } from '../personalization/themeCatalog'
import { loadTags } from '../tags/tagService'
import type { TagRecord } from '../tags/tagTypes'
import { loadNote, loadNotes, setNoteListAppearance } from './noteService'
import {
  DEFAULT_NOTE_VISUAL_COLOR,
  DEFAULT_NOTE_VISUAL_ICON,
  MAX_NOTE_VISUAL_DESCRIPTION_LENGTH,
  NOTE_VISUAL_COLORS,
  NOTE_VISUAL_ICONS,
  type NoteRecord,
  type NoteVisualIcon,
} from './noteTypes'
import './workspacePersonalization.css'

interface WorkspacePersonalizationData {
  notes: NoteRecord[]
  folders: FolderRecord[]
  tags: TagRecord[]
  folderFlags: Map<string, FolderAppearanceFlags>
}

interface NoteCustomizerDraft {
  title: string
  description: string
  categoryTagId: string
  icon: NoteVisualIcon
  color: string
}

const EMPTY_DATA: WorkspacePersonalizationData = {
  notes: [],
  folders: [],
  tags: [],
  folderFlags: new Map(),
}

const EMPTY_NOTE_DRAFT: NoteCustomizerDraft = {
  title: '',
  description: '',
  categoryTagId: '',
  icon: DEFAULT_NOTE_VISUAL_ICON,
  color: DEFAULT_NOTE_VISUAL_COLOR,
}

const PERSONALIZATION_RELOAD_DEBOUNCE_MS = 48

export function WorkspacePersonalizationRuntime() {
  const [data, setData] = useState<WorkspacePersonalizationData>(EMPTY_DATA)
  const [noteCustomizerId, setNoteCustomizerId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<NoteCustomizerDraft>(EMPTY_NOTE_DRAFT)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState('')
  const dataRef = useRef(data)
  const workspaceCountRef = useRef(0)
  const refreshTimerRef = useRef<number | null>(null)
  const decorateFrameRef = useRef<number | null>(null)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  function workspaceReorderActive() {
    return (
      document.documentElement.classList.contains('oanix-mobile-note-dragging')
      || document.documentElement.classList.contains('oanix-mobile-folder-dragging')
      || Boolean(document.querySelector('.oanix-folder-grid--drag-active, .oanix-organic-tags.is-reordering'))
    )
  }

  function scheduleDecorate() {
    if (workspaceReorderActive()) return
    if (decorateFrameRef.current !== null) window.cancelAnimationFrame(decorateFrameRef.current)
    decorateFrameRef.current = window.requestAnimationFrame(() => {
      decorateFrameRef.current = null
      if (workspaceReorderActive()) return
      decorateWorkspace()
    })
  }

  async function refreshData() {
    if (!document.querySelector('.notes-sidebar')) return
    try {
      const [notes, folders, tags, folderFlags] = await Promise.all([
        loadNotes(),
        loadFolders(),
        loadTags(),
        loadFolderAppearanceFlags(),
      ])
      const next = { notes, folders, tags, folderFlags }
      dataRef.current = next
      setData(next)
      scheduleDecorate()
    } catch {
      // This runtime only reads private UI data while an unlocked workspace exists.
    }
  }

  async function refreshChangedNote(noteId: string) {
    if (!document.querySelector('.notes-sidebar')) return
    try {
      const note = await loadNote(noteId)
      const current = dataRef.current
      const existingIndex = current.notes.findIndex((item) => item.id === noteId)
      const notes = note
        ? existingIndex >= 0
          ? current.notes.map((item) => item.id === noteId ? note : item)
          : [...current.notes, note]
        : current.notes.filter((item) => item.id !== noteId)
      const next = { ...current, notes }
      dataRef.current = next
      setData(next)
      scheduleDecorate()
    } catch {
      // A later full refresh or sync event can recover a transient read failure.
    }
  }

  function openNoteCustomizer(noteId: string) {
    const note = dataRef.current.notes.find((item) => item.id === noteId)
    if (!note) return
    const noteIndex = Math.max(0, dataRef.current.notes.findIndex((item) => item.id === note.id))
    const fallbackColor = NOTE_VISUAL_COLORS[noteIndex % NOTE_VISUAL_COLORS.length] ?? DEFAULT_NOTE_VISUAL_COLOR
    setNoteDraft({
      title: note.title,
      description: note.visualDescription ?? '',
      categoryTagId: note.visualCategoryTagId ?? note.tagIds?.[0] ?? '',
      icon: note.visualIcon ?? DEFAULT_NOTE_VISUAL_ICON,
      color: note.visualColor ?? fallbackColor,
    })
    setNoteError('')
    setNoteCustomizerId(noteId)
  }

  function decorateHeader() {
    const subtitle = document.querySelector<HTMLElement>('.notes-brand > div:last-child > span')
    if (subtitle) {
      const count = workspaceCountRef.current
      subtitle.textContent = `${count} Elemento${count === 1 ? '' : 's'}`
    }
  }

  function decorateNotes() {
    const folderNames = new Map(dataRef.current.folders.map((folder) => [folder.id, folder.name]))
    const tagNames = new Map(dataRef.current.tags.map((tag) => [tag.id, tag.name]))
    const noteById = new Map(dataRef.current.notes.map((note) => [note.id, note]))
    const searching = document.querySelector('.notes-shell')?.classList.contains('notes-shell--searching') === true

    document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]').forEach((row) => {
      const noteId = row.dataset.reorderNoteId
      if (!noteId) return
      const note = noteById.get(noteId)
      if (!note) return

      const categoryId = note.visualCategoryTagId ?? note.tagIds?.[0]
      const category = categoryId
        ? tagNames.get(categoryId) ?? 'NOTA'
        : note.folderId
          ? folderNames.get(note.folderId) ?? 'NOTA'
          : 'NOTA'
      row.dataset.oanixNoteCategory = category

      const preview = row.querySelector<HTMLElement>('.note-row__preview')
      if (preview) {
        if (!searching && note.visualDescription?.trim()) {
          preview.dataset.oanixNoteDescription = note.visualDescription.trim()
        } else {
          delete preview.dataset.oanixNoteDescription
        }
      }

      const menu = row.querySelector<HTMLElement>('.note-row__menu')
      if (menu && !menu.querySelector('[data-oanix-note-customize]')) {
        const customize = document.createElement('button')
        customize.type = 'button'
        customize.setAttribute('role', 'menuitem')
        customize.dataset.oanixNoteCustomize = note.id
        customize.className = 'oanix-note-customize-menuitem'
        customize.innerHTML = '<span aria-hidden="true">🎨</span> Personalizar'
        customize.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          openNoteCustomizer(note.id)
        })
        menu.prepend(customize)
      }
    })
  }

  function decorateFolders() {
    document.querySelectorAll<HTMLButtonElement>('.oanix-folder-rail__item[data-oanix-folder-id]').forEach((item) => {
      const folderId = item.dataset.oanixFolderId
      if (!folderId) return
      const flags = dataRef.current.folderFlags.get(folderId)

      item.classList.toggle('is-oanix-pinned', flags?.pinned === true)
      item.classList.toggle('is-oanix-favorite', flags?.favorite === true)

      let pin = item.querySelector<HTMLElement>('.oanix-folder-card__pin')
      if (flags?.pinned === true) {
        if (!pin) {
          pin = document.createElement('span')
          pin.className = 'oanix-folder-card__pin'
          pin.textContent = '📌'
          pin.setAttribute('aria-hidden', 'true')
          item.appendChild(pin)
        }
      } else {
        pin?.remove()
      }

      let favorite = item.querySelector<HTMLElement>('.oanix-folder-card__favorite')
      if (flags?.favorite === true) {
        if (!favorite) {
          favorite = document.createElement('span')
          favorite.className = 'oanix-folder-card__favorite'
          favorite.textContent = '★'
          favorite.setAttribute('aria-hidden', 'true')
          item.appendChild(favorite)
        }
      } else {
        favorite?.remove()
      }
    })
  }

  function decorateThemeControl() {
    const controls = Array.from(document.querySelectorAll<HTMLButtonElement>('.oanix-organic-folder-control'))
    const themeButton = controls.find((button) => !button.classList.contains('oanix-organic-folder-control--add'))
    if (!themeButton) return
    const current = document.documentElement.dataset.oanixTheme ?? readSavedOanixTheme()
    const day = current === 'classic-day'
    themeButton.dataset.oanixThemeToggle = 'true'
    themeButton.textContent = day ? '☾' : '☀'
    themeButton.disabled = false
    themeButton.setAttribute('aria-label', day ? 'Cambiar a modo Noche' : 'Cambiar a modo Día')
    themeButton.title = day ? 'Modo Noche' : 'Modo Día'
  }

  function decorateWorkspace() {
    decorateHeader()
    decorateNotes()
    decorateFolders()
    decorateThemeControl()
  }

  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    const workspaceObserver = new MutationObserver(() => scheduleDecorate())
    if (workspace) {
      workspaceObserver.observe(workspace, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-current'],
      })
    }

    const portalObserver = new MutationObserver(() => scheduleDecorate())
    portalObserver.observe(document.body, { childList: true })

    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        void refreshData()
      }, PERSONALIZATION_RELOAD_DEBOUNCE_MS)
    }

    const handleLocalChange = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { recordType?: unknown; recordId?: unknown } | null
        : null
      if (detail?.recordType === 'note' && typeof detail.recordId === 'string') {
        void refreshChangedNote(detail.recordId)
        return
      }
      scheduleRefresh()
    }
    const handleConflictResolved = () => scheduleRefresh()
    const handleThemeChange = () => scheduleDecorate()
    const handleWorkspaceCount = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { count?: unknown } | null
        : null
      if (typeof detail?.count !== 'number' || !Number.isFinite(detail.count)) return
      workspaceCountRef.current = Math.max(0, Math.trunc(detail.count))
      scheduleDecorate()
    }

    function handlePointerDownCapture(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-oanix-theme-toggle="true"]')) event.stopPropagation()
    }

    function handleClickCapture(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const themeButton = target.closest<HTMLElement>('[data-oanix-theme-toggle="true"]')
      if (themeButton) {
        event.preventDefault()
        event.stopPropagation()
        const current = document.documentElement.dataset.oanixTheme ?? readSavedOanixTheme()
        applyOanixTheme(current === 'classic-day' ? 'classic-night' : 'classic-day')
        scheduleDecorate()
      }
    }

    document.addEventListener('pointerdown', handlePointerDownCapture, true)
    document.addEventListener('click', handleClickCapture, true)
    window.addEventListener('oanix:local-data-changed', handleLocalChange)
    window.addEventListener('oanix:conflict-resolved', handleConflictResolved)
    window.addEventListener('oanix:theme-change', handleThemeChange)
    window.addEventListener('oanix:workspace-count-changed', handleWorkspaceCount)

    void refreshData()
    scheduleDecorate()

    return () => {
      workspaceObserver.disconnect()
      portalObserver.disconnect()
      document.removeEventListener('pointerdown', handlePointerDownCapture, true)
      document.removeEventListener('click', handleClickCapture, true)
      window.removeEventListener('oanix:local-data-changed', handleLocalChange)
      window.removeEventListener('oanix:conflict-resolved', handleConflictResolved)
      window.removeEventListener('oanix:theme-change', handleThemeChange)
      window.removeEventListener('oanix:workspace-count-changed', handleWorkspaceCount)
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
      if (decorateFrameRef.current !== null) window.cancelAnimationFrame(decorateFrameRef.current)
    }
  }, [])

  async function saveNoteCustomization() {
    if (!noteCustomizerId || noteSaving) return
    setNoteSaving(true)
    setNoteError('')
    try {
      const updated = await setNoteListAppearance(noteCustomizerId, {
        title: noteDraft.title,
        description: noteDraft.description,
        categoryTagId: noteDraft.categoryTagId || null,
        icon: noteDraft.icon,
        color: noteDraft.color,
      })
      const nextNotes = dataRef.current.notes.map((note) => note.id === updated.id ? updated : note)
      const next = { ...dataRef.current, notes: nextNotes }
      dataRef.current = next
      setData(next)
      window.dispatchEvent(new CustomEvent('oanix:note-visual-changed', { detail: { note: updated } }))
      setNoteCustomizerId(null)
      scheduleDecorate()
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : 'No se pudo guardar la personalización de la nota.')
    } finally {
      setNoteSaving(false)
    }
  }

  const noteCustomizer = noteCustomizerId
    ? data.notes.find((note) => note.id === noteCustomizerId) ?? null
    : null

  return (
    <>
      {noteCustomizer && createPortal(
        <div
          className="oanix-note-customizer-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && !noteSaving) setNoteCustomizerId(null)
          }}
        >
          <section
            className="oanix-note-customizer"
            role="dialog"
            aria-modal="true"
            aria-label={`Personalizar ${noteCustomizer.title}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className="oanix-note-customizer__header">
              <strong><span aria-hidden="true">✏️</span> Editar Elemento</strong>
              <button type="button" onClick={() => setNoteCustomizerId(null)} disabled={noteSaving} aria-label="Cerrar">×</button>
            </header>

            <div className="oanix-note-customizer__body">
              <label>
                <span>TÍTULO</span>
                <input
                  value={noteDraft.title}
                  onChange={(event) => setNoteDraft((current) => ({ ...current, title: event.target.value }))}
                  maxLength={160}
                  autoComplete="off"
                />
              </label>

              <label>
                <span>DESCRIPCIÓN</span>
                <textarea
                  value={noteDraft.description}
                  onChange={(event) => setNoteDraft((current) => ({ ...current, description: event.target.value }))}
                  maxLength={MAX_NOTE_VISUAL_DESCRIPTION_LENGTH}
                  rows={2}
                  placeholder="Descripción breve para la tarjeta"
                />
                <small>{noteDraft.description.length}/{MAX_NOTE_VISUAL_DESCRIPTION_LENGTH}</small>
              </label>

              <label>
                <span>CATEGORÍA</span>
                <select
                  value={noteDraft.categoryTagId}
                  onChange={(event) => setNoteDraft((current) => ({ ...current, categoryTagId: event.target.value }))}
                >
                  <option value="">Sin categoría</option>
                  {data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                </select>
              </label>

              <fieldset className="oanix-note-customizer__icons">
                <legend>ICONO CENTRAL</legend>
                <div>
                  {NOTE_VISUAL_ICONS.map((icon) => (
                    <button
                      type="button"
                      key={icon}
                      className={noteDraft.icon === icon ? 'is-selected' : ''}
                      onClick={() => setNoteDraft((current) => ({ ...current, icon }))}
                      aria-label={`Usar icono ${icon}`}
                      aria-pressed={noteDraft.icon === icon}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="oanix-note-customizer__colors">
                <legend>COLOR DE TARJETA</legend>
                <div>
                  {NOTE_VISUAL_COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={noteDraft.color === color ? 'is-selected' : ''}
                      style={{ '--oanix-note-picker-color': color } as CSSProperties}
                      onClick={() => setNoteDraft((current) => ({ ...current, color }))}
                      aria-label={`Usar color ${color}`}
                      aria-pressed={noteDraft.color === color}
                    />
                  ))}
                </div>
              </fieldset>

              {noteError && <p className="oanix-note-customizer__error" role="alert">{noteError}</p>}
            </div>

            <footer className="oanix-note-customizer__footer">
              <button type="button" onClick={() => setNoteCustomizerId(null)} disabled={noteSaving}>Cancelar</button>
              <button className="is-primary" type="button" onClick={() => void saveNoteCustomization()} disabled={noteSaving}>
                {noteSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
