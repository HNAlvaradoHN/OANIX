import { useMemo, type CSSProperties } from 'react'
import {
  folderAccent,
  folderSurfaceCss,
  noteHomeOrder,
  type FolderV2Record,
  type NoteV2Meta,
} from './rebuildModel'
import './noteListSection.css'

interface NoteListSectionProps {
  notes: readonly NoteV2Meta[]
  folderById: ReadonlyMap<string, FolderV2Record>
  canReorder: boolean
  onOpen: (noteId: string) => void
  onDelete: (note: NoteV2Meta) => void
  onCustomize: (note: NoteV2Meta) => void
  onSwap: (first: NoteV2Meta, second: NoteV2Meta) => void
  formatTime: (iso: string) => string
}

function folderStyle(folder: FolderV2Record): CSSProperties {
  return {
    '--folder-accent': folderAccent(folder),
    '--folder-soft': folderSurfaceCss(folder, 0.16),
    '--folder-strong': folderSurfaceCss(folder),
  } as CSSProperties
}

function noteStyle(note: NoteV2Meta, folder: FolderV2Record | null): CSSProperties | undefined {
  if (note.cardColor) {
    return {
      '--note-card-accent': note.cardColor,
      '--folder-accent': note.cardColor,
      '--folder-soft': `color-mix(in srgb, ${note.cardColor} 16%, transparent)`,
    } as CSSProperties
  }
  return folder ? folderStyle(folder) : undefined
}

export function NoteListSection({
  notes,
  folderById,
  canReorder,
  onOpen,
  onDelete,
  onCustomize,
  onSwap,
  formatTime,
}: NoteListSectionProps) {
  const displayedNotes = useMemo(() => {
    if (!canReorder) return [...notes]
    return [...notes].sort((left, right) => {
      const byOrder = noteHomeOrder(left) - noteHomeOrder(right)
      if (byOrder !== 0) return byOrder
      return left.id.localeCompare(right.id)
    })
  }, [notes, canReorder])

  return (
    <div className="rebuild-note-list">
      {displayedNotes.map((note, index) => {
        const folder = note.folderId ? folderById.get(note.folderId) ?? null : null
        const customized = Boolean(note.cardColor || note.cardIcon)
        return (
          <div
            key={note.id}
            className="rebuild-note-row"
            data-note-tint={note.cardColor ? 'true' : undefined}
            data-note-customized={customized ? 'true' : undefined}
            style={noteStyle(note, folder)}
          >
            <button
              type="button"
              className="rebuild-note-row__open"
              onClick={() => onOpen(note.id)}
            >
              <span className="rebuild-note-row__avatar" aria-hidden="true">
                {note.cardIcon ?? folder?.icon ?? '📝'}
              </span>
              <span className="rebuild-note-row__main">
                <strong>{note.title}</strong>
                <small>{folder?.name ?? 'Sin carpeta'}</small>
              </span>
              <span className="rebuild-note-row__time">{formatTime(note.updatedAt)}</span>
            </button>

            <div className="rebuild-note-row__actions" aria-label={`Acciones de ${note.title || 'nota'}`}>
              {canReorder && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const previous = displayedNotes[index - 1]
                      if (previous) onSwap(note, previous)
                    }}
                    aria-label={`Subir ${note.title || 'nota'}`}
                    title="Subir nota"
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = displayedNotes[index + 1]
                      if (next) onSwap(note, next)
                    }}
                    aria-label={`Bajar ${note.title || 'nota'}`}
                    title="Bajar nota"
                    disabled={index === displayedNotes.length - 1}
                  >
                    ↓
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onCustomize(note)}
                aria-label={`Personalizar ${note.title || 'nota'}`}
                title="Personalizar tarjeta"
              >
                🎨
              </button>
              <button
                type="button"
                className="rebuild-note-row__delete"
                onClick={() => onDelete(note)}
                aria-label={`Eliminar ${note.title || 'nota'}`}
                title="Eliminar nota"
              >
                🗑️
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
