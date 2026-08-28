import { useEffect, useMemo, useState } from 'react'
import { loadFolders } from '../folders/folderService'
import type { FolderRecord } from '../folders/folderTypes'
import {
  defaultFolderColor,
  loadFolderColors,
  loadFolderIcons,
} from '../folders/folderAppearanceService'
import { DEFAULT_FOLDER_ICON, type FolderIcon } from '../folders/folderAppearanceCatalog'
import { loadTags } from '../tags/tagService'
import type { TagRecord } from '../tags/tagTypes'
import { loadNotes } from '../notes/noteService'
import {
  DEFAULT_NOTE_VISUAL_COLOR,
  DEFAULT_NOTE_VISUAL_ICON,
  compareNotesForList,
  noteBlocksToPlainText,
  type NoteRecord,
} from '../notes/noteTypes'
import './workspaceV2.css'

export interface WorkspaceV2ListPaneProps {
  activeFolderId?: string | 'all'
  activeTagId?: string | 'all'
  selectedNoteId?: string | null
  onSelectFolder?: (folderId: string | 'all') => void
  onSelectTag?: (tagId: string | 'all') => void
  onSelectNote?: (noteId: string) => void
}

interface FolderVisual {
  color: string
  icon: FolderIcon
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat('es-HN', { hour: 'numeric', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit' }).format(date)
}

function preview(note: NoteRecord): string {
  return note.visualDescription?.trim()
    || noteBlocksToPlainText(note.content.blocks).trim()
    || 'Nota vacía · empieza a escribir'
}

export function WorkspaceV2ListPane({
  activeFolderId = 'all',
  activeTagId = 'all',
  selectedNoteId = null,
  onSelectFolder,
  onSelectTag,
  onSelectNote,
}: WorkspaceV2ListPaneProps) {
  const [folders, setFolders] = useState<FolderRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [folderVisuals, setFolderVisuals] = useState<Map<string, FolderVisual>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      setLoading(true)
      setError('')
      try {
        const [nextFolders, nextTags, nextNotes, colors, icons] = await Promise.all([
          loadFolders(),
          loadTags(),
          loadNotes(),
          loadFolderColors(),
          loadFolderIcons(),
        ])
        if (cancelled) return

        const visuals = new Map<string, FolderVisual>()
        for (const folder of nextFolders) {
          visuals.set(folder.id, {
            color: colors.get(folder.id) ?? defaultFolderColor(),
            icon: icons.get(folder.id) ?? DEFAULT_FOLDER_ICON,
          })
        }
        setFolders(nextFolders)
        setTags(nextTags)
        setNotes([...nextNotes].sort(compareNotesForList))
        setFolderVisuals(visuals)
      } catch {
        if (!cancelled) setError('No se pudo cargar la lista cifrada de OANIX.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void hydrate()
    const refresh = () => void hydrate()
    window.addEventListener('oanix:workspace-refresh', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('oanix:workspace-refresh', refresh)
    }
  }, [])

  const visibleNotes = useMemo(() => notes.filter((note) => (
    (activeFolderId === 'all' || note.folderId === activeFolderId)
    && (activeTagId === 'all' || (note.tagIds ?? []).includes(activeTagId))
  )), [notes, activeFolderId, activeTagId])

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])

  return (
    <section className="oanix-workspace-v2" aria-label="Panel de notas OANIX V2">
      <div className="oanix-workspace-v2__folders" role="navigation" aria-label="Carpetas">
        <button
          className={`oanix-workspace-v2__folder${activeFolderId === 'all' ? ' is-active' : ''}`}
          type="button"
          onClick={() => onSelectFolder?.('all')}
        >
          <span className="oanix-workspace-v2__folder-icon" aria-hidden="true">⌂</span>
          <span>Todas</span>
        </button>
        {folders.map((folder) => {
          const visual = folderVisuals.get(folder.id)
          return (
            <button
              className={`oanix-workspace-v2__folder${activeFolderId === folder.id ? ' is-active' : ''}`}
              type="button"
              key={folder.id}
              onClick={() => onSelectFolder?.(folder.id)}
              style={{ '--oanix-v2-folder-color': visual?.color ?? defaultFolderColor() } as React.CSSProperties}
            >
              <span className="oanix-workspace-v2__folder-icon" aria-hidden="true">{visual?.icon ?? DEFAULT_FOLDER_ICON}</span>
              <span>{folder.name}</span>
            </button>
          )
        })}
      </div>

      <div className="oanix-workspace-v2__tags" role="navigation" aria-label="Etiquetas">
        <button
          className={`oanix-workspace-v2__tag${activeTagId === 'all' ? ' is-active' : ''}`}
          type="button"
          onClick={() => onSelectTag?.('all')}
        >
          Todas
        </button>
        {tags.map((tag) => (
          <button
            className={`oanix-workspace-v2__tag${activeTagId === tag.id ? ' is-active' : ''}`}
            type="button"
            key={tag.id}
            onClick={() => onSelectTag?.(tag.id)}
            style={{ '--oanix-v2-tag-color': tag.color } as React.CSSProperties}
          >
            <span aria-hidden="true">{tag.icon}</span>
            <span>{tag.name}</span>
          </button>
        ))}
      </div>

      <div className="oanix-workspace-v2__list" aria-live="polite">
        {loading && <div className="oanix-workspace-v2__empty">Descifrando tu espacio…</div>}
        {!loading && error && <div className="oanix-workspace-v2__empty" role="alert">{error}</div>}
        {!loading && !error && visibleNotes.length === 0 && (
          <div className="oanix-workspace-v2__empty">No hay notas en esta vista.</div>
        )}
        {!loading && !error && visibleNotes.map((note) => {
          const categoryTag = note.visualCategoryTagId ? tagById.get(note.visualCategoryTagId) : undefined
          const color = note.visualColor ?? categoryTag?.color ?? DEFAULT_NOTE_VISUAL_COLOR
          const icon = note.visualIcon ?? categoryTag?.icon ?? DEFAULT_NOTE_VISUAL_ICON
          return (
            <button
              className={`oanix-workspace-v2__note${selectedNoteId === note.id ? ' is-selected' : ''}`}
              type="button"
              key={note.id}
              onClick={() => onSelectNote?.(note.id)}
              style={{ '--oanix-v2-note-color': color } as React.CSSProperties}
            >
              <span className="oanix-workspace-v2__note-icon" aria-hidden="true">{icon}</span>
              <span className="oanix-workspace-v2__note-copy">
                <strong>{note.title || 'Sin título'}</strong>
                <span>{preview(note)}</span>
              </span>
              <time dateTime={note.updatedAt}>{formatUpdatedAt(note.updatedAt)}</time>
            </button>
          )
        })}
      </div>
    </section>
  )
}
