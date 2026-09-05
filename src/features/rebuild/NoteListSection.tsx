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
  noteFolderOrder,
  noteHomeOrder,
  type FolderV2Record,
  type NoteV2Meta,
} from './rebuildModel'
import './noteListSection.css'

type NoteOrderMode = 'home' | 'folder' | null

interface NoteListSectionProps {
  notes: readonly NoteV2Meta[]
  folderById: ReadonlyMap<string, FolderV2Record>
  orderMode: NoteOrderMode
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

interface PointerPosition {
  x: number
  y: number
}

const DRAG_HOLD_MS = 200
const DRAG_MOVE_THRESHOLD_PX = 6
const AUTO_SCROLL_EDGE_PX = 82
const AUTO_SCROLL_MIN_PX = 0.8
const AUTO_SCROLL_MAX_PX = 12
const AUTO_SCROLL_EASING = 0.2

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

function noteOrder(note: NoteV2Meta, mode: Exclude<NoteOrderMode, null>): number {
  return mode === 'folder' ? noteFolderOrder(note) : noteHomeOrder(note)
}

export function NoteListSection({
  notes,
  folderById,
  orderMode,
  onOpen,
  onDelete,
  onCustomize,
  onMove,
  formatTime,
}: NoteListSectionProps) {
  const canReorder = orderMode !== null
  const displayedNotes = useMemo(() => {
    if (!orderMode) return [...notes]
    return [...notes].sort((left, right) => {
      const byOrder = noteOrder(left, orderMode) - noteOrder(right, orderMode)
      if (byOrder !== 0) return byOrder
      return left.id.localeCompare(right.id)
    })
  }, [notes, orderMode])

  const [pressingId, setPressingId] = useState<string | null>(null)
  const [readyId, setReadyId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOrder, setDragOrderState] = useState<string[] | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const pressCandidateRef = useRef<DragPressCandidate | null>(null)
  const pressTimerRef = useRef<number | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const dragOrderRef = useRef<string[] | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const pointerPositionRef = useRef<PointerPosition | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const autoScrollVelocityRef = useRef(0)

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

  function stopAutoScroll() {
    autoScrollVelocityRef.current = 0
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
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
      if (autoScrollFrameRef.current !== null) window.cancelAnimationFrame(autoScrollFrameRef.current)
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

  function scrollContainer(): HTMLElement | null {
    return listRef.current?.closest<HTMLElement>('.rebuild-notes') ?? null
  }

  function nearestRowAtEdge(noteId: string, y: number): HTMLElement | null {
    const list = listRef.current
    if (!list) return null
    const rows = [...list.querySelectorAll<HTMLElement>('[data-oanix-note-id]')]
      .filter((row) => row.dataset.oanixNoteId !== noteId)
    if (rows.length === 0) return null

    return rows.reduce<HTMLElement | null>((nearest, row) => {
      if (!nearest) return row
      const rowRect = row.getBoundingClientRect()
      const nearestRect = nearest.getBoundingClientRect()
      const rowDistance = Math.abs(y - (rowRect.top + rowRect.height / 2))
      const nearestDistance = Math.abs(y - (nearestRect.top + nearestRect.height / 2))
      return rowDistance < nearestDistance ? row : nearest
    }, null)
  }

  function rowAtPointExcludingDragged(noteId: string, x: number, y: number): HTMLElement | null {
    const list = listRef.current
    if (!list) return null

    for (const element of document.elementsFromPoint(x, y)) {
      const row = element.closest<HTMLElement>('[data-oanix-note-id]')
      if (!row || !list.contains(row) || row.dataset.oanixNoteId === noteId) continue
      return row
    }

    return null
  }

  function reorderAtPoint(noteId: string, x: number, y: number) {
    const order = dragOrderRef.current
    if (!order) return

    let target = rowAtPointExcludingDragged(noteId, x, y)

    if (!target) {
      const container = scrollContainer()
      const rect = container?.getBoundingClientRect()
      if (
        rect
        && (y <= rect.top + AUTO_SCROLL_EDGE_PX || y >= rect.bottom - AUTO_SCROLL_EDGE_PX)
      ) {
        target = nearestRowAtEdge(noteId, y)
      }
    }

    const targetId = target?.dataset.oanixNoteId
    if (!target || !targetId) return

    const withoutDragged = order.filter((id) => id !== noteId)
    let insertIndex = withoutDragged.indexOf(targetId)
    if (insertIndex < 0) return

    const rect = target.getBoundingClientRect()
    if (y >= rect.top + rect.height / 2) insertIndex += 1

    const next = [...withoutDragged]
    next.splice(insertIndex, 0, noteId)
    if (!sameOrder(order, next)) updateDragOrder(next)
  }

  function autoScrollTargetVelocity(pointerY: number, rect: DOMRect): number {
    let direction = 0
    let strength = 0

    if (pointerY < rect.top + AUTO_SCROLL_EDGE_PX) {
      direction = -1
      strength = Math.min(1, (rect.top + AUTO_SCROLL_EDGE_PX - pointerY) / AUTO_SCROLL_EDGE_PX)
    } else if (pointerY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
      direction = 1
      strength = Math.min(1, (pointerY - (rect.bottom - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX)
    }

    if (direction === 0) return 0
    const easedStrength = strength * strength
    const speed = AUTO_SCROLL_MIN_PX + (AUTO_SCROLL_MAX_PX - AUTO_SCROLL_MIN_PX) * easedStrength
    return direction * speed
  }

  function reachedScrollBoundary(container: HTMLElement, velocity: number): boolean {
    if (velocity < 0) return container.scrollTop <= 0
    if (velocity > 0) {
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
      return container.scrollTop >= maxScrollTop - 0.5
    }
    return false
  }

  function runAutoScroll() {
    autoScrollFrameRef.current = null
    const noteId = draggingIdRef.current
    const pointer = pointerPositionRef.current
    const container = scrollContainer()
    if (!noteId || !pointer || !container) return

    const targetVelocity = autoScrollTargetVelocity(pointer.y, container.getBoundingClientRect())
    const currentVelocity = autoScrollVelocityRef.current
    const nextVelocity = currentVelocity + (targetVelocity - currentVelocity) * AUTO_SCROLL_EASING
    autoScrollVelocityRef.current = Math.abs(nextVelocity) < 0.08 ? 0 : nextVelocity

    if (targetVelocity === 0) {
      autoScrollVelocityRef.current = 0
      return
    }

    if (reachedScrollBoundary(container, targetVelocity)) {
      autoScrollVelocityRef.current = 0
      return
    }

    if (autoScrollVelocityRef.current !== 0) {
      container.scrollTop += autoScrollVelocityRef.current
      reorderAtPoint(noteId, pointer.x, pointer.y)
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
  }

  function ensureAutoScroll() {
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
    }
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
    if (!noteId || !dragOrderRef.current) return

    event.preventDefault()
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
    reorderAtPoint(noteId, event.clientX, event.clientY)
    ensureAutoScroll()
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
    pointerPositionRef.current = null
    stopAutoScroll()
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
    <div ref={listRef} className={`rebuild-note-list${draggingId ? ' is-reordering' : ''}`}>
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
