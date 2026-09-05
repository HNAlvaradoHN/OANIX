import {
  useEffect,
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

interface DragPressCandidate {
  noteId: string
  pointerId: number
  startX: number
  startY: number
  armed: boolean
}

const DRAG_HOLD_MS = 200
const DRAG_MOVE_THRESHOLD_PX = 6

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

  const [pressingId, setPressingId] = useState<string | null>(null)
  const [readyId, setReadyId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOrder, setDragOrderState] = useState<string[] | null>(null)
  const pressCandidateRef = useRef<DragPressCandidate | null>(null)
  const pressTimerRef = useRef<number | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const dragOrderRef = useRef<string[] | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  const renderedNotes = useMemo(() => {
    if (!dragOrder) return displayedNotes
    const byId = new Map(displayedNotes.map((note) => [note.id, note]))
    return dragOrder.map((id) => byId.get(id)).filter((note): note is NoteV2Meta => Boolean(note))
  }, [displayedNotes, dragOrder])

  function clearPressTimer() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  function clearPressCandidate() {
    clearPressTimer()
    pressCandidateRef.current = null
    setPressingId(null)
    setReadyId(null)
  }

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current)
    }
  }, [])

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

  function beginPress(event: PointerEvent<HTMLButtonElement>, noteId: string) {
    if (!canReorder || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    clearPressCandidate()
    const candidate: DragPressCandidate = {
      noteId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
    }
    pressCandidateRef.current = candidate
    setPressingId(noteId)
    event.currentTarget.setPointerCapture(event.pointerId)

    pressTimerRef.current = window.setTimeout(() => {
      const current = pressCandidateRef.current
      if (!current || current.pointerId !== event.pointerId || current.noteId !== noteId) return
      current.armed = true
      pressTimerRef.current = null
      setReadyId(noteId)
    }, DRAG_HOLD_MS)
  }

  function activateDrag(noteId: string, pointerId: number) {
    clearPressTimer()
    const order = displayedNotes.map((note) => note.id)
    draggingIdRef.current = noteId
    pointerIdRef.current = pointerId
    setDraggingId(noteId)
    setPressingId(null)
    setReadyId(null)
    updateDragOrder(order)
  }

  function cancelPendingPress(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    clearPressCandidate()
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const candidate = pressCandidateRef.current
    if (!candidate || candidate.pointerId !== event.pointerId) return

    const distance = Math.hypot(
      event.clientX - candidate.startX,
      event.clientY - candidate.startY,
    )

    if (!draggingIdRef.current) {
      if (!candidate.armed) {
        if (distance >= DRAG_MOVE_THRESHOLD_PX) cancelPendingPress(event)
        return
      }
      if (distance < DRAG_MOVE_THRESHOLD_PX) return
      activateDrag(candidate.noteId, event.pointerId)
    }

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
    const candidate = pressCandidateRef.current
    const activePointer = pointerIdRef.current
    if (candidate?.pointerId !== event.pointerId && activePointer !== event.pointerId) return
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
    clearPressCandidate()

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
    <div className={`rebuild-note-list${draggingId ? ' is-reordering' : ''}`}>
      {renderedNotes.map((note) => {
        const folder = note.folderId ? folderById.get(note.folderId) ?? null : null
        const customized = Boolean(note.cardColor || note.cardIcon)
        const dragClass = draggingId === note.id
          ? ' is-dragging'
          : readyId === note.id
            ? ' is-drag-ready'
            : pressingId === note.id
              ? ' is-drag-pressing'
              : ''
        return (
          <div
            key={note.id}
            className={`rebuild-note-row${dragClass}`}
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
                  onPointerDown={(event) => beginPress(event, note.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={(event) => finishDrag(event, true)}
                  onPointerCancel={(event) => finishDrag(event, false)}
                  onContextMenu={(event) => event.preventDefault()}
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
