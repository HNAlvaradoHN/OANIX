import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
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
  onMove: (note: NoteV2Meta, previous: NoteV2Meta | null, next: NoteV2Meta | null) => void
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

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export function NoteListSection({
  notes,
  folderById,
  canReorder,
  onOpen,
  onDelete,
  onCustomize,
  onMove,
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

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOrder, setDragOrderState] = useState<string[] | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const dragOrderRef = useRef<string[] | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  const renderedNotes = useMemo(() => {
    if (!dragOrder) return displayedNotes
    const byId = new Map(displayedNotes.map((note) => [note.id, note]))
    return dragOrder.map((id) => byId.get(id)).filter((note): note is NoteV2Meta => Boolean(note))
  }, [displayedNotes, dragOrder])

  function updateDragOrder(next: string[] | null) {
    dragOrderRef.current = next
    setDragOrderState(next)
  }

  function commitOrder(noteId: string, order: readonly string[]) {
    const original = displayedNotes.map((note) => note.id)
    if (sameOrder(original, order)) return

    const byId = new Map(displayedNotes.map((note) => [note.id, note]))
    const note = byId.get(noteId)
    const index = order.indexOf(noteId)
    if (!note || index < 0) return

    const previous = index > 0 ? byId.get(order[index - 1]) ?? null : null
    const next = index < order.length - 1 ? byId.get(order[index + 1]) ?? null : null
    onMove(note, previous, next)
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, noteId: string) {
    if (!canReorder || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const order = displayedNotes.map((note) => note.id)
    draggingIdRef.current = noteId
    pointerIdRef.current = event.pointerId
    setDraggingId(noteId)
    updateDragOrder(order)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== event.pointerId) return
    const noteId = draggingIdRef.current
    const order = dragOrderRef.current
    if (!noteId || !order) return

    event.preventDefault()
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-oanix-note-id]')
    const targetId = target?.dataset.oanixNoteId
    if (!target || !targetId || targetId === noteId) return

    const withoutDragged = order.filter((id) => id !== noteId)
    let insertIndex = withoutDragged.indexOf(targetId)
    if (insertIndex < 0) return

    const rect = target.getBoundingClientRect()
    if (event.clientY >= rect.top + rect.height / 2) insertIndex += 1

    const next = [...withoutDragged]
    next.splice(insertIndex, 0, noteId)
    if (!sameOrder(order, next)) updateDragOrder(next)
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    if (pointerIdRef.current !== event.pointerId) return
    event.preventDefault()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const noteId = draggingIdRef.current
    const order = dragOrderRef.current
    draggingIdRef.current = null
    pointerIdRef.current = null
    setDraggingId(null)
    updateDragOrder(null)

    if (commit && noteId && order) commitOrder(noteId, order)
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, noteId: string) {
    if (!canReorder || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    const order = displayedNotes.map((note) => note.id)
    const index = order.indexOf(noteId)
    const targetIndex = event.key === 'ArrowUp' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= order.length) return

    event.preventDefault()
    order.splice(index, 1)
    order.splice(targetIndex, 0, noteId)
    commitOrder(noteId, order)
  }

  return (
    <div className="rebuild-note-list">
      {renderedNotes.map((note) => {
        const folder = note.folderId ? folderById.get(note.folderId) ?? null : null
        const customized = Boolean(note.cardColor || note.cardIcon)
        return (
          <div
            key={note.id}
            className={`rebuild-note-row${draggingId === note.id ? ' is-dragging' : ''}`}
            data-oanix-note-id={note.id}
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
                <button
                  type="button"
                  className="rebuild-note-row__drag"
                  onPointerDown={(event) => beginDrag(event, note.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={(event) => finishDrag(event, true)}
                  onPointerCancel={(event) => finishDrag(event, false)}
                  onKeyDown={(event) => moveWithKeyboard(event, note.id)}
                  aria-label={`Mover ${note.title || 'nota'}`}
                  title="Mantén presionado y arrastra para mover"
                >
                  ⠿
                </button>
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
