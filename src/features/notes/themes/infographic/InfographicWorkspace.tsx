import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  type FolderIcon,
} from '../../../folders/folderAppearanceCatalog'
import {
  loadFolderAppearanceFlags,
  loadFolderColors,
  loadFolderIcons,
  type FolderAppearanceFlags,
} from '../../../folders/folderAppearanceService'
import { loadFolderCovers } from '../../../folders/folderCoverService'
import { OanixIcon } from '../../../../shared/OanixIcon'
import {
  DEFAULT_TAG_COLOR,
  DEFAULT_TAG_ICON,
  type TagRecord,
} from '../../../tags/tagTypes'
import {
  DEFAULT_NOTE_VISUAL_COLOR,
  DEFAULT_NOTE_VISUAL_ICON,
  noteBlocksToPlainText,
  type NoteRecord,
} from '../../noteTypes'
import type { WorkspaceThemeProps } from '../../workspaceThemeContract'
import { WorkspaceV2FolderActions } from '../../WorkspaceV2FolderActions'
import { WorkspaceV2FolderCreator } from '../../WorkspaceV2FolderCreator'
import { WorkspaceV2NoteCustomizer } from '../../WorkspaceV2NoteCustomizer'
import { WorkspaceV2TagActions } from '../../WorkspaceV2TagActions'
import { InfographicThemeDragRuntime } from './InfographicThemeDragRuntime'
import './infographicTheme.css'

const FOLDER_SHAPES = [
  'shape-blob1',
  'shape-blob2',
  'shape-circle',
  'shape-splatter',
  'shape-squircle',
  'shape-diamond',
] as const

function rgbFromHex(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex)
    ? hex.slice(1)
    : DEFAULT_NOTE_VISUAL_COLOR.slice(1)
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function contrastColor(hex: string): string {
  const [red, green, blue] = rgbFromHex(hex)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.5 ? '#1e293b' : '#ffffff'
}

function noteDescription(note: NoteRecord): string {
  return note.visualDescription?.trim()
    || noteBlocksToPlainText(note.content.blocks)
    || 'Nota privada'
}

function relativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.max(0, Math.round((start - target) / 86_400_000))

  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days <= 6) return 'Hace ' + days + ' días'
  return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: 'short' }).format(date)
}

function folderGradient(color: string): CSSProperties {
  return { '--inf-folder-color': color } as CSSProperties
}

function categoryForNote(note: NoteRecord, tags: TagRecord[]): TagRecord | null {
  const preferredId = note.visualCategoryTagId || note.tagIds?.[0]
  return preferredId ? tags.find((tag) => tag.id === preferredId) ?? null : null
}

export function InfographicWorkspace({
  folders,
  tags,
  notes,
  visibleNotes,
  loading,
  creating,
  deletingId,
  error,
  selectedId,
  activeFolderId,
  activeTagId,
  searchOpen,
  searchQuery,
  searchInputRef,
  workspaceMenuOpen,
  backupBusy,
  onSearchToggle,
  onSearchQueryChange,
  onClearSearch,
  onLock,
  onWorkspaceMenuToggle,
  onOpenFolderManager,
  onOpenTagManager,
  onExportBackup,
  onSelectFolder,
  onSelectTag,
  onCreateNote,
  onSelectNote,
  onTogglePinned,
  onOpenTagEditor,
  onOpenMoveNote,
  onDeleteNote,
  onCreateTag,
  onDeleteTag,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCustomizeNote,
  onFolderOrder,
  onTagOrder,
  onNoteOrder,
}: WorkspaceThemeProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const tagScrollRef = useRef<HTMLDivElement | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const [darkMode, setDarkMode] = useState(false)
  const [folderColors, setFolderColors] = useState(new Map<string, string>())
  const [folderIcons, setFolderIcons] = useState(new Map<string, FolderIcon>())
  const [folderCovers, setFolderCovers] = useState(new Map<string, string>())
  const [folderFlags, setFolderFlags] = useState(new Map<string, FolderAppearanceFlags>())
  const [folderActionsId, setFolderActionsId] = useState<string | null>(null)
  const [folderCreatorOpen, setFolderCreatorOpen] = useState(false)
  const [noteCustomizerId, setNoteCustomizerId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    document.body.classList.toggle('oanix-infographic-dark', darkMode)
    return () => document.body.classList.remove('oanix-infographic-dark')
  }, [darkMode])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const reloadAppearance = async () => {
      try {
        const [colors, icons, covers, flags] = await Promise.all([
          loadFolderColors(),
          loadFolderIcons(),
          loadFolderCovers(),
          loadFolderAppearanceFlags(),
        ])
        if (disposed) return
        setFolderColors(colors)
        setFolderIcons(icons)
        setFolderCovers(covers)
        setFolderFlags(flags)
      } catch {
        // Appearance is decorative; encrypted records remain authoritative.
      }
    }

    const handleLocalChange = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { recordType?: unknown } | null
        : null
      if (
        !detail?.recordType
        || detail.recordType === 'folder'
        || detail.recordType === 'folder-appearance'
        || detail.recordType === 'folder-cover'
      ) {
        void reloadAppearance()
      }
    }

    void reloadAppearance()
    window.addEventListener('oanix:local-data-changed', handleLocalChange)
    return () => {
      disposed = true
      window.removeEventListener('oanix:local-data-changed', handleLocalChange)
    }
  }, [])

  const noteCountByFolder = useMemo(() => {
    const counts = new Map<string, number>()
    for (const note of notes) {
      if (!note.folderId) continue
      counts.set(note.folderId, (counts.get(note.folderId) ?? 0) + 1)
    }
    return counts
  }, [notes])

  const activeFolderName = activeFolderId === 'all'
    ? 'Todas las notas'
    : folders.find((folder) => folder.id === activeFolderId)?.name ?? 'Notas'

  const activeFolderCover = activeFolderId === 'all'
    ? ''
    : folderCovers.get(activeFolderId) ?? ''

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setToast('')
      toastTimerRef.current = null
    }, 1_800)
  }, [])

  function scrollTags(direction: 'left' | 'right') {
    const container = tagScrollRef.current
    if (!container) return
    const amount = Math.max(120, Math.round(container.clientWidth * 0.55))
    container.scrollBy({
      left: direction === 'right' ? amount : -amount,
      behavior: 'smooth',
    })
  }

  return (
    <aside
      ref={rootRef}
      className={
        'notes-sidebar oanix-workspace-v2 oanix-infographic-theme'
        + (darkMode ? ' dark-mode' : '')
        + (searchOpen ? ' is-search-open' : '')
        + (activeFolderCover ? ' has-wallpaper' : '')
      }
      aria-label="Lista de notas"
      data-oanix-workspace-v2="true"
      data-oanix-workspace-theme="infographic"
    >
      <span
        className="oanix-infographic-theme__background"
        style={activeFolderCover
          ? { '--inf-wallpaper': 'url("' + activeFolderCover + '")' } as CSSProperties
          : undefined}
        aria-hidden="true"
      />

      <InfographicThemeDragRuntime
        rootRef={rootRef}
        disabled={searchOpen}
        onFolderOrder={onFolderOrder}
        onTagOrder={onTagOrder}
        onNoteOrder={onNoteOrder}
        onStatus={showToast}
      />

      <header className="notes-header oanix-infographic-header">
        <div className="notes-brand oanix-infographic-brand">
          <div className="notes-brand__mark oanix-infographic-brand__logo" aria-hidden="true">O</div>
          <div className="oanix-infographic-brand__text">
            <strong>OANIX</strong>
            <span>{activeFolderName}</span>
          </div>
        </div>

        <div className="notes-header__actions oanix-infographic-header__actions" data-note-menu-root="true">
          <button
            className={'icon-button' + (searchOpen ? ' icon-button--active' : '')}
            type="button"
            onClick={onSearchToggle}
            aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar en notas'}
            title={searchOpen ? 'Cerrar búsqueda' : 'Buscar'}
            data-infographic-drag-ignore="true"
          >
            <OanixIcon name="search" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onLock}
            aria-label="Bloquear OANIX"
            title="Bloquear OANIX"
            data-infographic-drag-ignore="true"
          >
            <OanixIcon name="lock" />
          </button>
          <div className="workspace-menu-wrap">
            <button
              className="icon-button"
              type="button"
              onClick={onWorkspaceMenuToggle}
              aria-label="Menú de OANIX"
              aria-haspopup="menu"
              aria-expanded={workspaceMenuOpen}
              data-infographic-drag-ignore="true"
            >
              <OanixIcon name="menu" />
            </button>
          </div>
        </div>
      </header>

      {workspaceMenuOpen && createPortal(
        <div
          className="oanix-infographic-menu-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onWorkspaceMenuToggle()
          }}
        >
          <div
            className="workspace-menu oanix-infographic-focus-menu"
            role="menu"
            aria-label="Acciones de OANIX"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <strong>OANIX</strong>
            <button type="button" role="menuitem" onClick={onOpenFolderManager}>
              <OanixIcon name="folder" /> Administrar carpetas
            </button>
            <button type="button" role="menuitem" onClick={onOpenTagManager}>
              <OanixIcon name="tag" /> Administrar etiquetas
            </button>
            <button type="button" role="menuitem" disabled={backupBusy} onClick={onExportBackup}>
              <OanixIcon name="backup" /> {backupBusy ? 'Creando backup…' : 'Exportar backup cifrado'}
            </button>
            <button type="button" role="menuitem" onClick={onWorkspaceMenuToggle}>
              <OanixIcon name="close" /> Cerrar
            </button>
          </div>
        </div>,
        document.body,
      )}

      {searchOpen && (
        <div className="notes-search oanix-infographic-search" role="search">
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Buscar notas..."
            autoComplete="off"
            spellCheck={false}
            aria-label="Buscar en títulos y contenido de notas"
          />
          {searchQuery.trim() && (
            <button type="button" onClick={onClearSearch} aria-label="Limpiar búsqueda">×</button>
          )}
          <div className="notes-search__meta">Búsqueda local cifrada</div>
        </div>
      )}

      <main className="oanix-infographic-main">
        <div className="oanix-infographic-main__layer">
          <div className="oanix-infographic-chips-wrapper">
            <div
              ref={tagScrollRef}
              className="oanix-infographic-chips-scroll"
              data-infographic-scroll-kind="tag"
            >
              <button
                type="button"
                className={'info-chip' + (activeTagId === 'all' ? ' active' : '')}
                onClick={() => onSelectTag('all')}
              >
                <span
                  className="info-chip__icon"
                  style={{ '--inf-tag-color': DEFAULT_TAG_COLOR } as CSSProperties}
                >
                  ✨
                </span>
                <span>Todo</span>
              </button>

              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={'info-chip' + (activeTagId === tag.id ? ' active' : '')}
                  style={{ '--inf-tag-color': tag.color ?? DEFAULT_TAG_COLOR } as CSSProperties}
                  data-infographic-drag-kind="tag"
                  data-infographic-id={tag.id}
                  onClick={() => onSelectTag(tag.id)}
                >
                  <span className="info-chip__icon">{tag.icon ?? DEFAULT_TAG_ICON}</span>
                  <span>{tag.name}</span>
                </button>
              ))}
            </div>

            <div className="oanix-infographic-chip-controls">
              <div className="oanix-infographic-chip-arrows" aria-label="Mover etiquetas">
                <button type="button" onClick={() => scrollTags('left')} aria-label="Etiquetas anteriores">‹</button>
                <button type="button" onClick={() => scrollTags('right')} aria-label="Etiquetas siguientes">›</button>
              </div>
              <WorkspaceV2TagActions
                tags={tags}
                onCreate={onCreateTag}
                onDelete={onDeleteTag}
              />
            </div>
          </div>

          <div
            className="notes-list oanix-infographic-notes-scroll"
            data-infographic-scroll-kind="note"
          >
            {error && <p className="oanix-infographic-error" role="alert">{error}</p>}

            {loading ? (
              <div className="oanix-infographic-empty"><strong>Cargando notas…</strong></div>
            ) : visibleNotes.length === 0 ? (
              <div className="oanix-infographic-empty">
                <strong>{
                  searchQuery.trim()
                    ? 'Sin resultados'
                    : activeTagId !== 'all'
                      ? 'Sin notas con esta etiqueta'
                      : 'Carpeta vacía'
                }</strong>
                <span>{searchQuery.trim() ? 'Prueba con otra búsqueda.' : 'Crea una nota para empezar.'}</span>
              </div>
            ) : (
              <div className="timeline-container">
                {visibleNotes.map((note) => {
                  const category = categoryForNote(note, tags)
                  const color = note.visualColor ?? category?.color ?? DEFAULT_NOTE_VISUAL_COLOR
                  const [red, green, blue] = rgbFromHex(color)
                  const textColor = darkMode ? '#ffffff' : contrastColor(color)
                  const badgeColor = category?.color ?? color

                  return (
                    <article
                      key={note.id}
                      className={
                        'note-row timeline-item'
                        + (selectedId === note.id ? ' note-row--selected is-selected' : '')
                      }
                      data-infographic-drag-kind="note"
                      data-infographic-id={note.id}
                      data-infographic-group={note.pinned === true ? 'pinned' : 'normal'}
                      data-reorder-note-id={note.id}
                    >
                      <span
                        className="timeline-dot"
                        style={{ '--dot-color': badgeColor } as CSSProperties}
                        aria-hidden="true"
                      />

                      <div
                        className="note-row__open infographic-card glass-card"
                        style={{
                          '--card-r': red,
                          '--card-g': green,
                          '--card-b': blue,
                          '--text-contrast': textColor,
                        } as CSSProperties}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectNote(note.id)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            event.currentTarget.click()
                          }
                        }}
                      >
                        <div className="info-date" style={{ color: textColor }}>
                          <span>{relativeDate(note.updatedAt)}</span>
                          <span
                            className="info-category-badge"
                            style={{ background: badgeColor }}
                          >
                            {category?.name ?? (note.pinned ? 'Fijada' : 'Nota')}
                          </span>
                        </div>

                        <span className="note-row__topline">
                          <strong className="info-main-title" style={{ color: textColor }}>
                            {note.visualIcon ?? DEFAULT_NOTE_VISUAL_ICON} {note.title}
                          </strong>
                        </span>

                        <p className="info-sub-desc" style={{ color: textColor }}>
                          {noteDescription(note)}
                        </p>

                        <div className="oanix-workspace-v2__note-actions info-right-actions" data-v2-note-actions="true">
                          <button
                            type="button"
                            className="action-icon-btn"
                            data-infographic-drag-ignore="true"
                            onClick={(event) => {
                              event.stopPropagation()
                              onTogglePinned(note)
                            }}
                            title={note.pinned ? 'Desfijar' : 'Fijar'}
                            aria-label={note.pinned ? 'Desfijar nota' : 'Fijar nota'}
                          >
                            <OanixIcon name="pin" />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn"
                            data-infographic-drag-ignore="true"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenTagEditor(note)
                            }}
                            title="Etiquetas"
                            aria-label="Editar etiquetas"
                          >
                            <OanixIcon name="tag" />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn"
                            data-infographic-drag-ignore="true"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenMoveNote(note)
                            }}
                            title="Mover a carpeta"
                            aria-label="Mover a carpeta"
                          >
                            <OanixIcon name="folder" />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn"
                            data-infographic-drag-ignore="true"
                            onClick={(event) => {
                              event.stopPropagation()
                              setNoteCustomizerId(note.id)
                            }}
                            title="Editar tarjeta"
                            aria-label="Editar tarjeta"
                          >
                            <OanixIcon name="palette" />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn"
                            data-infographic-drag-ignore="true"
                            onClick={(event) => {
                              event.stopPropagation()
                              window.dispatchEvent(new CustomEvent('oanix:open-note-privacy', {
                                detail: { noteId: note.id },
                              }))
                            }}
                            title="Privacidad"
                            aria-label="Privacidad de la nota"
                          >
                            <OanixIcon name="shield" />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn delete"
                            data-infographic-drag-ignore="true"
                            disabled={deletingId !== null}
                            onClick={(event) => {
                              event.stopPropagation()
                              onDeleteNote(note)
                            }}
                            title="Eliminar"
                            aria-label="Eliminar nota"
                          >
                            {deletingId === note.id ? '…' : <OanixIcon name="trash" />}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <button
        className="notes-create-fab fab-add-note"
        type="button"
        onClick={onCreateNote}
        disabled={creating || Boolean(searchQuery.trim())}
        aria-label={creating ? 'Creando nota' : 'Crear nueva nota'}
        title={creating ? 'Creando…' : 'Nueva nota'}
        aria-busy={creating}
      >
        {creating ? <span aria-hidden="true">…</span> : <OanixIcon name="plus" size={24} />}
      </button>

      <footer className="oanix-infographic-dock" aria-label="Carpetas">
        <div className="oanix-infographic-dock__actions">
          <button
            type="button"
            className="oanix-infographic-dock__add"
            onClick={() => setFolderCreatorOpen(true)}
            aria-label="Agregar carpeta"
            title="Agregar carpeta"
          >
            <OanixIcon name="plus" size={19} />
          </button>
          <button
            type="button"
            className="oanix-infographic-dock__theme"
            onClick={() => setDarkMode((current) => !current)}
            aria-label={darkMode ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
            title={darkMode ? 'Modo día' : 'Modo noche'}
          >
            <OanixIcon name={darkMode ? 'sun' : 'moon'} size={18} />
          </button>
        </div>

        <div className="oanix-infographic-folders" data-infographic-scroll-kind="folder">
          <button
            type="button"
            className={'folder-item-wrapper folder-item-wrapper--all' + (activeFolderId === 'all' ? ' active' : '')}
            onClick={() => onSelectFolder('all')}
            aria-label={'Todas las notas, ' + notes.length}
            title="Todas las notas"
          >
            <span className="folder-icon-container">
              <span className="folder-icon-btn">
                <span className="icon-shape shape-squircle" style={folderGradient('#2563eb')}>
                  <OanixIcon name="grid" size={22} />
                </span>
              </span>
              {notes.length > 0 && <span className="icon-badge">{notes.length}</span>}
            </span>
            <span className="folder-title-small">Todas</span>
          </button>

          {folders.map((folder, index) => {
            const color = folderColors.get(folder.id) ?? DEFAULT_FOLDER_COLOR
            const icon = folderIcons.get(folder.id) ?? DEFAULT_FOLDER_ICON
            const cover = folderCovers.get(folder.id) ?? ''
            const flags = folderFlags.get(folder.id)
            const shape = FOLDER_SHAPES[index % FOLDER_SHAPES.length]

            return (
              <div
                key={folder.id}
                className={'folder-item-wrapper' + (activeFolderId === folder.id ? ' active' : '')}
                data-infographic-drag-kind="folder"
                data-infographic-id={folder.id}
                style={folderGradient(color)}
              >
                <button
                  type="button"
                  className="folder-item-wrapper__open"
                  onClick={() => onSelectFolder(folder.id)}
                  title={folder.name}
                  aria-label={'Abrir carpeta ' + folder.name}
                >
                  <span className="folder-icon-container">
                    <span className="folder-icon-btn">
                      <span className={'icon-shape ' + shape}>
                        {cover
                          ? <img src={cover} alt="" draggable={false} />
                          : <span className="icon-emoji">{icon}</span>}
                      </span>
                    </span>
                    {flags?.pinned && <span className="icon-pin" title="Fijada">📌</span>}
                    {flags?.favorite && <span className="icon-fav" title="Favorita">⭐</span>}
                    {(noteCountByFolder.get(folder.id) ?? 0) > 0 && (
                      <span className="icon-badge">{noteCountByFolder.get(folder.id) ?? 0}</span>
                    )}
                  </span>
                  <span className="folder-title-small">{folder.name}</span>
                </button>

                <div className="sidebar-single-gear">
                  <button
                    type="button"
                    className="side-gear-btn"
                    data-infographic-drag-ignore="true"
                    onClick={() => setFolderActionsId(folder.id)}
                    aria-label={'Opciones de ' + folder.name}
                    title="Opciones"
                  >
                    <OanixIcon name="sliders" size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </footer>

      <WorkspaceV2FolderCreator
        open={folderCreatorOpen}
        onClose={() => setFolderCreatorOpen(false)}
        onCreate={onCreateFolder}
      />

      {noteCustomizerId && (() => {
        const note = notes.find((candidate) => candidate.id === noteCustomizerId)
        if (!note) return null
        return (
          <WorkspaceV2NoteCustomizer
            key={note.id}
            note={note}
            tags={tags}
            onClose={() => setNoteCustomizerId(null)}
            onSave={onCustomizeNote}
          />
        )
      })()}

      {folderActionsId && (() => {
        const folder = folders.find((candidate) => candidate.id === folderActionsId)
        if (!folder) return null
        return (
          <WorkspaceV2FolderActions
            folder={folder}
            color={folderColors.get(folder.id) ?? DEFAULT_FOLDER_COLOR}
            icon={folderIcons.get(folder.id) ?? DEFAULT_FOLDER_ICON}
            cover={folderCovers.get(folder.id) ?? ''}
            flags={folderFlags.get(folder.id)}
            onClose={() => setFolderActionsId(null)}
            onRename={onRenameFolder}
            onDelete={onDeleteFolder}
          />
        )
      })()}

      {toast && <div className="oanix-infographic-toast" role="status">{toast}</div>}
    </aside>
  )
}
