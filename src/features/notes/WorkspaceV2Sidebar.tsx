import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  type FolderIcon,
} from '../folders/folderAppearanceCatalog'
import {
  loadFolderAppearanceFlags,
  loadFolderColors,
  loadFolderIcons,
  type FolderAppearanceFlags,
} from '../folders/folderAppearanceService'
import { loadFolderCovers } from '../folders/folderCoverService'
import type { FolderRecord } from '../folders/folderTypes'
import {
  applyOanixTheme,
  readSavedOanixTheme,
  type OanixThemePreset,
} from '../personalization/themeCatalog'
import { OanixIcon } from '../../shared/OanixIcon'
import {
  DEFAULT_TAG_COLOR,
  DEFAULT_TAG_ICON,
  type TagRecord,
} from '../tags/tagTypes'
import {
  DEFAULT_NOTE_VISUAL_COLOR,
  DEFAULT_NOTE_VISUAL_ICON,
  noteBlocksToPlainText,
  type NoteRecord,
} from './noteTypes'
import { WorkspaceV2DragRuntime } from './WorkspaceV2DragRuntime'
import { WorkspaceV2TagActions } from './WorkspaceV2TagActions'
import { WorkspaceV2FolderActions } from './WorkspaceV2FolderActions'
import { WorkspaceV2FolderCreator } from './WorkspaceV2FolderCreator'
import { WorkspaceV2NoteCustomizer } from './WorkspaceV2NoteCustomizer'
import type { NoteListAppearanceInput } from './noteService'
import './workspaceV2.css'

interface WorkspaceV2SidebarProps {
  folders: FolderRecord[]
  tags: TagRecord[]
  notes: NoteRecord[]
  visibleNotes: NoteRecord[]
  loading: boolean
  creating: boolean
  deletingId: string | null
  error: string
  selectedId: string | null
  activeFolderId: string | 'all'
  activeTagId: string | 'all'
  searchOpen: boolean
  searchQuery: string
  searchInputRef: RefObject<HTMLInputElement | null>
  workspaceMenuOpen: boolean
  backupBusy: boolean
  onSearchToggle: () => void
  onSearchQueryChange: (query: string) => void
  onClearSearch: () => void
  onLock: () => void
  onWorkspaceMenuToggle: () => void
  onOpenFolderManager: () => void
  onOpenTagManager: () => void
  onExportBackup: () => void
  onSelectFolder: (folderId: string | 'all') => void
  onSelectTag: (tagId: string | 'all') => void
  onCreateNote: () => void
  onSelectNote: (noteId: string) => void
  onTogglePinned: (note: NoteRecord) => void
  onOpenTagEditor: (note: NoteRecord) => void
  onOpenMoveNote: (note: NoteRecord) => void
  onDeleteNote: (note: NoteRecord) => void
  onCreateTag: (name: string, appearance: { icon: string; color: string }) => Promise<void>
  onDeleteTag: (tag: TagRecord) => Promise<void>
  onCreateFolder: (name: string, appearance: { icon: FolderIcon; color: string }) => Promise<void>
  onRenameFolder: (folder: FolderRecord, name: string) => Promise<void>
  onDeleteFolder: (folder: FolderRecord) => Promise<void>
  onCustomizeNote: (noteId: string, input: NoteListAppearanceInput) => Promise<void>
  onFolderOrder: (ids: string[]) => void
  onTagOrder: (ids: string[]) => void
  onNoteOrder: (ids: string[]) => void
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat('es-HN', { hour: 'numeric', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: 'short' }).format(date)
}

function rgbFromHex(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : DEFAULT_NOTE_VISUAL_COLOR.slice(1)
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function contrastFor(hex: string, themeId: OanixThemePreset['id']): string {
  const color = rgbFromHex(hex)
  const night = themeId === 'classic-night'
  const base: [number, number, number] = night ? [17, 24, 39] : [248, 250, 252]
  const tintAlpha = night ? 0.5 : 0.42
  const [red, green, blue] = color.map((channel, index) =>
    Math.round(channel * tintAlpha + base[index] * (1 - tintAlpha)),
  ) as [number, number, number]

  const linear = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }
  const luminance = linear(red) * 0.2126 + linear(green) * 0.7152 + linear(blue) * 0.0722
  const whiteContrast = 1.05 / (luminance + 0.05)
  const inkLuminance = 0.014
  const inkContrast = (luminance + 0.05) / (inkLuminance + 0.05)
  return inkContrast >= whiteContrast ? '#172033' : '#ffffff'
}

function noteDescription(note: NoteRecord): string {
  return note.visualDescription?.trim() || noteBlocksToPlainText(note.content.blocks) || 'Nota privada'
}

export function WorkspaceV2Sidebar({
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
}: WorkspaceV2SidebarProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const [folderColors, setFolderColors] = useState(new Map<string, string>())
  const [folderIcons, setFolderIcons] = useState(new Map<string, FolderIcon>())
  const [folderCovers, setFolderCovers] = useState(new Map<string, string>())
  const [folderFlags, setFolderFlags] = useState(new Map<string, FolderAppearanceFlags>())
  const [folderActionsId, setFolderActionsId] = useState<string | null>(null)
  const [folderCreatorOpen, setFolderCreatorOpen] = useState(false)
  const [noteCustomizerId, setNoteCustomizerId] = useState<string | null>(null)
  const [themeId, setThemeId] = useState<OanixThemePreset['id']>(() => readSavedOanixTheme())

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
        // Folder appearance is decorative. The encrypted records remain authoritative.
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
    window.addEventListener('oanix:folder-appearance-saved', reloadAppearance)
    return () => {
      disposed = true
      window.removeEventListener('oanix:local-data-changed', handleLocalChange)
      window.removeEventListener('oanix:folder-appearance-saved', reloadAppearance)
    }
  }, [])

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null
      if (detail === 'classic-day' || detail === 'classic-night') setThemeId(detail)
    }
    window.addEventListener('oanix:theme-change', handleThemeChange)
    return () => window.removeEventListener('oanix:theme-change', handleThemeChange)
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

  function toggleTheme() {
    const nextTheme = themeId === 'classic-night' ? 'classic-day' : 'classic-night'
    setThemeId(applyOanixTheme(nextTheme))
  }

  const activeTag = activeTagId === 'all'
    ? null
    : tags.find((tag) => tag.id === activeTagId) ?? null

  const categoryForNote = (note: NoteRecord): TagRecord | null => {
    const preferredId = note.visualCategoryTagId || note.tagIds?.[0]
    return preferredId ? tags.find((tag) => tag.id === preferredId) ?? null : null
  }

  return (
    <aside
      ref={rootRef}
      className={`notes-sidebar oanix-workspace-v2${activeFolderCover ? ' has-wallpaper' : ''}`}
      aria-label="Lista de notas"
      data-oanix-workspace-v2="true"
    >
      {activeFolderCover && (
        <span
          className="oanix-workspace-v2__wallpaper"
          style={{ '--v2-folder-wallpaper': `url("${activeFolderCover}")` } as CSSProperties}
          aria-hidden="true"
        />
      )}

      <WorkspaceV2DragRuntime
        rootRef={rootRef}
        disabled={searchOpen}
        onFolderOrder={onFolderOrder}
        onTagOrder={onTagOrder}
        onNoteOrder={onNoteOrder}
      />

      <header className="notes-header oanix-workspace-v2__header">
        <div className="notes-brand oanix-workspace-v2__brand">
          <div className="notes-brand__mark" aria-hidden="true">O</div>
          <div>
            <strong>OANIX</strong>
            <span>{activeFolderName}</span>
          </div>
        </div>

        <div className="notes-header__actions oanix-workspace-v2__header-actions" data-note-menu-root="true">
          <button
            className={`icon-button${searchOpen ? ' icon-button--active' : ''}`}
            type="button"
            onClick={onSearchToggle}
            aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar en notas'}
            title={searchOpen ? 'Cerrar búsqueda' : 'Buscar'}
            data-v2-drag-ignore="true"
          >
            <OanixIcon name="search" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onLock}
            aria-label="Bloquear OANIX"
            title="Bloquear OANIX"
            data-v2-drag-ignore="true"
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
              data-v2-drag-ignore="true"
            >
              <OanixIcon name="menu" />
            </button>
          </div>
        </div>
      </header>

      {workspaceMenuOpen && createPortal(
        <div
          className="oanix-workspace-v2__menu-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onWorkspaceMenuToggle()
          }}
        >
          <div
            className="workspace-menu oanix-workspace-v2__focus-menu"
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
        <div className="notes-search oanix-workspace-v2__search" role="search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Buscar en toda la bóveda"
            autoComplete="off"
            spellCheck={false}
            aria-label="Buscar en títulos y contenido de notas"
          />
          {searchQuery.trim() && (
            <button type="button" onClick={onClearSearch} aria-label="Limpiar búsqueda">×</button>
          )}
          <div className="notes-search__meta oanix-workspace-v2__search-meta">
            Búsqueda local cifrada
          </div>
        </div>
      )}

      <section className="oanix-workspace-v2__chips-shell" aria-label="Etiquetas">
        <div className="oanix-workspace-v2__chips" data-v2-scroll-kind="tag">
          <button
            type="button"
            className={`oanix-workspace-v2__chip${activeTagId === 'all' ? ' is-active' : ''}`}
            onClick={() => onSelectTag('all')}
            data-v2-drag-ignore="true"
          >
            <span className="oanix-workspace-v2__chip-icon">✨</span>
            Todo
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`oanix-workspace-v2__chip${activeTagId === tag.id ? ' is-active' : ''}`}
              style={{
                '--v2-tag-color': tag.color ?? DEFAULT_TAG_COLOR,
              } as CSSProperties}
              data-v2-drag-kind="tag"
              data-v2-id={tag.id}
              onClick={() => onSelectTag(tag.id)}
            >
              <span className="oanix-workspace-v2__chip-icon">{tag.icon ?? DEFAULT_TAG_ICON}</span>
              {tag.name}
            </button>
          ))}
        </div>
        <WorkspaceV2TagActions
          tags={tags}
          onCreate={onCreateTag}
          onDelete={onDeleteTag}
        />
      </section>

      {error && <p className="oanix-workspace-v2__error" role="alert">{error}</p>}

      <div className="notes-list oanix-workspace-v2__notes-scroll" data-v2-scroll-kind="note">
        {loading ? (
          <div className="oanix-workspace-v2__empty"><strong>Cargando notas…</strong></div>
        ) : visibleNotes.length === 0 ? (
          <div className="oanix-workspace-v2__empty">
            <strong>{searchQuery.trim() ? 'Sin resultados' : activeTag ? 'Sin notas con esta etiqueta' : 'Carpeta vacía'}</strong>
            <span>{searchQuery.trim() ? 'Prueba con otra búsqueda.' : 'Crea una nota para empezar.'}</span>
          </div>
        ) : (
          <div className="oanix-workspace-v2__timeline">
            {visibleNotes.map((note) => {
              const category = categoryForNote(note)
              const color = note.visualColor ?? category?.color ?? DEFAULT_NOTE_VISUAL_COLOR
              const [red, green, blue] = rgbFromHex(color)
              const textColor = contrastFor(color, themeId)
              return (
                <article
                  key={note.id}
                  className={`note-row oanix-workspace-v2__timeline-item${selectedId === note.id ? ' is-selected note-row--selected' : ''}`}
                  data-v2-drag-kind="note"
                  data-v2-id={note.id}
                  data-reorder-note-id={note.id}
                  data-v2-group={note.pinned === true ? 'pinned' : 'normal'}
                >
                  <span
                    className="oanix-workspace-v2__timeline-dot"
                    style={{ '--v2-note-color': color } as CSSProperties}
                    aria-hidden="true"
                  />
                  <div
                    className="note-row__open oanix-workspace-v2__note-card"
                    style={{
                      '--v2-note-r': red,
                      '--v2-note-g': green,
                      '--v2-note-b': blue,
                      '--v2-note-text': textColor,
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
                    <div className="oanix-workspace-v2__note-meta">
                      <span>{formatDate(note.updatedAt)}</span>
                      <span className="oanix-workspace-v2__note-category">
                        {category?.icon ?? (note.pinned ? '📌' : DEFAULT_NOTE_VISUAL_ICON)}
                        {' '}
                        {category?.name ?? (note.pinned ? 'Fijada' : 'Nota')}
                      </span>
                    </div>
                    <span className="note-row__topline oanix-workspace-v2__note-title-line">
                      <strong className="oanix-workspace-v2__note-title">
                        {note.visualIcon ?? DEFAULT_NOTE_VISUAL_ICON} {note.title}
                      </strong>
                    </span>
                    <p className="oanix-workspace-v2__note-description">{noteDescription(note)}</p>
                    <div className="oanix-workspace-v2__note-actions" data-v2-note-actions="true">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onTogglePinned(note)
                        }}
                        title={note.pinned ? 'Desfijar' : 'Fijar'}
                        aria-label={note.pinned ? 'Desfijar nota' : 'Fijar nota'}
                        data-v2-drag-ignore="true"
                      >
                        <OanixIcon name="pin" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenTagEditor(note)
                        }}
                        title="Etiquetas"
                        aria-label="Editar etiquetas"
                        data-v2-drag-ignore="true"
                      >
                        <OanixIcon name="tag" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenMoveNote(note)
                        }}
                        title="Mover a carpeta"
                        aria-label="Mover a carpeta"
                        data-v2-drag-ignore="true"
                      >
                        <OanixIcon name="folder" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setNoteCustomizerId(note.id)
                        }}
                        title="Personalizar tarjeta"
                        aria-label="Personalizar tarjeta"
                        data-v2-drag-ignore="true"
                      >
                        <OanixIcon name="palette" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          window.dispatchEvent(new CustomEvent('oanix:open-note-privacy', {
                            detail: { noteId: note.id },
                          }))
                        }}
                        title="Privacidad"
                        aria-label="Privacidad de la nota"
                        data-v2-drag-ignore="true"
                      >
                        <OanixIcon name="shield" />
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        disabled={deletingId !== null}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteNote(note)
                        }}
                        title="Eliminar"
                        aria-label="Eliminar nota"
                        data-v2-drag-ignore="true"
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

      <button
        className="notes-create-fab oanix-workspace-v2__create-note"
        type="button"
        onClick={onCreateNote}
        disabled={creating || Boolean(searchQuery.trim())}
        aria-label={creating ? 'Creando nota' : 'Crear nueva nota'}
        title={creating ? 'Creando…' : 'Nueva nota'}
        aria-busy={creating}
        data-v2-drag-ignore="true"
      >
        {creating ? <span aria-hidden="true">…</span> : <OanixIcon name="noteAdd" size={21} />}
      </button>

      <footer className="oanix-workspace-v2__folder-dock" aria-label="Carpetas">
        <button
          type="button"
          className={`oanix-workspace-v2__folder oanix-workspace-v2__folder--all${activeFolderId === 'all' ? ' is-active' : ''}`}
          onClick={() => onSelectFolder('all')}
          aria-label={`Todas las notas, ${notes.length}`}
          title="Todas las notas"
          data-v2-drag-ignore="true"
        >
          <span className="oanix-workspace-v2__folder-shape"><OanixIcon name="grid" size={20} /></span>
          <strong>Todas</strong>
          <small>{notes.length}</small>
        </button>

        <div className="oanix-workspace-v2__folder-scroll" data-v2-scroll-kind="folder">
          {folders.map((folder) => {
            const color = folderColors.get(folder.id) ?? DEFAULT_FOLDER_COLOR
            const icon = folderIcons.get(folder.id) ?? DEFAULT_FOLDER_ICON
            const cover = folderCovers.get(folder.id) ?? ''
            const flags = folderFlags.get(folder.id)
            return (
              <div
                key={folder.id}
                className={`oanix-workspace-v2__folder${activeFolderId === folder.id ? ' is-active' : ''}`}
                data-v2-drag-kind="folder"
                data-v2-id={folder.id}
                style={{ '--v2-folder-color': color } as CSSProperties}
              >
                <button
                  type="button"
                  className="oanix-workspace-v2__folder-main"
                  onClick={() => onSelectFolder(folder.id)}
                  title={folder.name}
                  aria-label={`Abrir carpeta ${folder.name}`}
                >
                  <span className="oanix-workspace-v2__folder-shape">
                    {cover ? <img src={cover} alt="" draggable={false} /> : <span>{icon}</span>}
                  </span>
                  <strong>{folder.name}</strong>
                  <small>{noteCountByFolder.get(folder.id) ?? 0}</small>
                  {(flags?.pinned || flags?.favorite) && (
                    <span className="oanix-workspace-v2__folder-flags" aria-hidden="true">
                      {flags.pinned ? '📌' : ''}{flags.favorite ? '⭐' : ''}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="oanix-workspace-v2__folder-gear"
                  onClick={() => setFolderActionsId(folder.id)}
                  aria-label={`Opciones de ${folder.name}`}
                  title="Opciones de carpeta"
                  data-v2-drag-ignore="true"
                >
                  <OanixIcon name="sliders" size={14} />
                </button>
              </div>
            )
          })}
        </div>

        <div className="oanix-workspace-v2__dock-actions" aria-label="Controles del espacio">
          <button
            type="button"
            className="oanix-workspace-v2__dock-action"
            onClick={toggleTheme}
            aria-label={themeId === 'classic-night' ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
            title={themeId === 'classic-night' ? 'Modo día' : 'Modo noche'}
            data-v2-drag-ignore="true"
          >
            <OanixIcon name={themeId === 'classic-night' ? 'sun' : 'moon'} size={20} />
          </button>
          <button
            type="button"
            className="oanix-workspace-v2__dock-action oanix-workspace-v2__dock-action--add"
            onClick={() => setFolderCreatorOpen(true)}
            aria-label="Agregar carpeta"
            title="Agregar carpeta"
            data-v2-drag-ignore="true"
          >
            <OanixIcon name="plus" size={21} />
          </button>
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
    </aside>
  )
}
