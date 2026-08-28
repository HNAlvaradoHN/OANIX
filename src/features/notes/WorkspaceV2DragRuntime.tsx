import { useEffect, type RefObject } from 'react'

export type WorkspaceV2DragKind = 'folder' | 'tag' | 'note'

interface WorkspaceV2DragCallbacks {
  onFolderOrder: (ids: string[]) => void
  onTagOrder: (ids: string[]) => void
  onNoteOrder: (ids: string[]) => void
}

interface WorkspaceV2DragRuntimeProps extends WorkspaceV2DragCallbacks {
  rootRef: RefObject<HTMLElement | null>
  disabled?: boolean
}

type ActiveGesture = {
  pointerId: number
  kind: WorkspaceV2DragKind
  item: HTMLElement
  container: HTMLElement
  startX: number
  startY: number
  lastX: number
  lastY: number
  timer: number | null
  dragging: boolean
  ghost: HTMLElement | null
  ghostWidth: number
  ghostHeight: number
  scrollFrame: number | null
  initialOrder: string[]
  group: string
}

const LONG_PRESS_MS: Record<WorkspaceV2DragKind, number> = {
  folder: 500,
  tag: 400,
  note: 400,
}

const EDGE_ZONE: Record<WorkspaceV2DragKind, number> = {
  folder: 70,
  tag: 60,
  note: 70,
}

function itemSelector(kind: WorkspaceV2DragKind): string {
  return `[data-v2-drag-kind="${kind}"][data-v2-id]`
}

function draggableItems(container: HTMLElement, kind: WorkspaceV2DragKind, group = ''): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(itemSelector(kind)))
    .filter((item) => !group || (item.dataset.v2Group ?? '') === group)
}

function orderOf(container: HTMLElement, kind: WorkspaceV2DragKind): string[] {
  return draggableItems(container, kind)
    .flatMap((item) => item.dataset.v2Id ? [item.dataset.v2Id] : [])
}

function suppressClicks(root: HTMLElement) {
  root.dataset.v2SuppressClickUntil = String(performance.now() + 180)
}

function clickSuppressed(root: HTMLElement): boolean {
  return Number(root.dataset.v2SuppressClickUntil ?? 0) > performance.now()
}

export function workspaceV2ClickSuppressed(root: HTMLElement | null): boolean {
  return root ? clickSuppressed(root) : false
}

export function WorkspaceV2DragRuntime({
  rootRef,
  onFolderOrder,
  onTagOrder,
  onNoteOrder,
  disabled = false,
}: WorkspaceV2DragRuntimeProps) {
  useEffect(() => {
    const candidateRoot = rootRef.current
    if (!candidateRoot || disabled) return
    const activeRoot: HTMLElement = candidateRoot

    let gesture: ActiveGesture | null = null

    function stopAutoScroll() {
      if (!gesture || gesture.scrollFrame === null) return
      window.cancelAnimationFrame(gesture.scrollFrame)
      gesture.scrollFrame = null
    }

    function moveGhost(x: number, y: number) {
      if (!gesture?.ghost) return
      gesture.ghost.style.left = `${x - gesture.ghostWidth / 2}px`
      gesture.ghost.style.top = `${y - gesture.ghostHeight / 2}px`
    }

    function targetAtPoint(x: number, y: number): HTMLElement | null {
      if (!gesture) return null
      if (gesture.ghost) gesture.ghost.style.display = 'none'
      const target = document.elementFromPoint(x, y)
        ?.closest<HTMLElement>(itemSelector(gesture.kind)) ?? null
      if (gesture.ghost) gesture.ghost.style.display = ''
      if (!target || target === gesture.item || target.parentElement !== gesture.container) return null
      if (gesture.group && (target.dataset.v2Group ?? '') !== gesture.group) return null
      return target
    }

    function reorderAtPoint(x: number, y: number) {
      if (!gesture?.dragging) return
      const target = targetAtPoint(x, y)
      if (!target) return
      const rect = target.getBoundingClientRect()
      const before = gesture.kind === 'note'
        ? y < rect.top + rect.height / 2
        : x < rect.left + rect.width / 2
      const destination = before ? target : target.nextElementSibling
      if (destination === gesture.item || gesture.item.nextElementSibling === destination) return
      gesture.container.insertBefore(gesture.item, destination)
    }

    function startAutoScroll() {
      if (!gesture || gesture.scrollFrame !== null) return
      const tick = () => {
        if (!gesture?.dragging) return
        const rect = gesture.container.getBoundingClientRect()
        const zone = EDGE_ZONE[gesture.kind]
        let speed = 0

        if (gesture.kind === 'note') {
          if (gesture.lastY < rect.top + zone) {
            speed = -Math.min(20, (rect.top + zone - gesture.lastY) / 3 + 4)
          } else if (gesture.lastY > rect.bottom - zone) {
            speed = Math.min(20, (gesture.lastY - (rect.bottom - zone)) / 3 + 4)
          }
          if (speed !== 0) gesture.container.scrollTop += speed
        } else {
          if (gesture.lastX < rect.left + zone) {
            speed = -Math.min(18, (rect.left + zone - gesture.lastX) / 3 + 4)
          } else if (gesture.lastX > rect.right - zone) {
            speed = Math.min(18, (gesture.lastX - (rect.right - zone)) / 3 + 4)
          }
          if (speed !== 0) gesture.container.scrollLeft += speed
        }

        if (speed !== 0) reorderAtPoint(gesture.lastX, gesture.lastY)
        gesture.scrollFrame = window.requestAnimationFrame(tick)
      }
      gesture.scrollFrame = window.requestAnimationFrame(tick)
    }

    function beginDrag() {
      if (!gesture || gesture.dragging) return
      gesture.timer = null
      gesture.dragging = true
      gesture.initialOrder = orderOf(gesture.container, gesture.kind)

      const rect = gesture.item.getBoundingClientRect()
      gesture.ghostWidth = rect.width
      gesture.ghostHeight = rect.height
      const ghost = gesture.item.cloneNode(true) as HTMLElement
      ghost.classList.add('oanix-workspace-v2__drag-ghost')
      ghost.removeAttribute('data-v2-id')
      ghost.removeAttribute('data-v2-drag-kind')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.style.width = `${rect.width}px`
      ghost.style.minHeight = `${rect.height}px`
      document.body.appendChild(ghost)
      gesture.ghost = ghost

      gesture.item.classList.add('is-v2-drag-source')
      gesture.container.classList.add('is-v2-dragging')
      document.documentElement.classList.add(`oanix-v2-${gesture.kind}-dragging`)
      moveGhost(gesture.lastX, gesture.lastY)
      startAutoScroll()
      navigator.vibrate?.(gesture.kind === 'folder' ? 45 : 28)
    }

    function clearGestureVisuals() {
      if (!gesture) return
      stopAutoScroll()
      gesture.ghost?.remove()
      gesture.item.classList.remove('is-v2-drag-source')
      gesture.container.classList.remove('is-v2-dragging')
      document.documentElement.classList.remove(`oanix-v2-${gesture.kind}-dragging`)
    }

    function cancelGesture(restore = false) {
      if (!gesture) return
      if (gesture.timer !== null) window.clearTimeout(gesture.timer)
      if (restore && gesture.dragging) {
        const byId = new Map(
          draggableItems(gesture.container, gesture.kind)
            .flatMap((item) => item.dataset.v2Id ? [[item.dataset.v2Id, item] as const] : []),
        )
        gesture.initialOrder.forEach((id) => {
          const item = byId.get(id)
          if (item) gesture?.container.appendChild(item)
        })
      }
      clearGestureVisuals()
      gesture = null
    }

    function persistGesture() {
      if (!gesture) return
      if (gesture.timer !== null) window.clearTimeout(gesture.timer)
      const wasDragging = gesture.dragging
      const kind = gesture.kind
      const nextOrder = orderOf(gesture.container, kind)
      const changed = wasDragging && nextOrder.join(',') !== gesture.initialOrder.join(',')

      clearGestureVisuals()
      if (wasDragging) suppressClicks(activeRoot)
      gesture = null

      if (!changed) return
      if (kind === 'folder') onFolderOrder(nextOrder)
      if (kind === 'tag') onTagOrder(nextOrder)
      if (kind === 'note') onNoteOrder(nextOrder)
    }

    function handlePointerMove(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      gesture.lastX = event.clientX
      gesture.lastY = event.clientY

      if (!gesture.dragging) {
        if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 10) {
          if (gesture.timer !== null) window.clearTimeout(gesture.timer)
          gesture.timer = null
        }
        return
      }

      event.preventDefault()
      moveGhost(event.clientX, event.clientY)
      reorderAtPoint(event.clientX, event.clientY)
    }

    function handlePointerUp(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      persistGesture()
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('pointercancel', handlePointerCancel, true)
    }

    function handlePointerCancel(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      cancelGesture(true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('pointercancel', handlePointerCancel, true)
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || gesture) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('button[data-v2-drag-ignore="true"], a, input, textarea, select, [contenteditable="true"]')) return

      const item = target.closest<HTMLElement>('[data-v2-drag-kind][data-v2-id]')
      if (!item || !activeRoot.contains(item)) return
      const kind = item.dataset.v2DragKind as WorkspaceV2DragKind | undefined
      if (kind !== 'folder' && kind !== 'tag' && kind !== 'note') return
      const container = item.parentElement
      if (!container) return

      gesture = {
        pointerId: event.pointerId,
        kind,
        item,
        container,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        timer: null,
        dragging: false,
        ghost: null,
        ghostWidth: 0,
        ghostHeight: 0,
        scrollFrame: null,
        initialOrder: [],
        group: item.dataset.v2Group ?? '',
      }
      gesture.timer = window.setTimeout(beginDrag, LONG_PRESS_MS[kind])

      document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
      document.addEventListener('pointerup', handlePointerUp, true)
      document.addEventListener('pointercancel', handlePointerCancel, true)
    }

    function handleClick(event: MouseEvent) {
      if (!clickSuppressed(activeRoot)) return
      event.preventDefault()
      event.stopPropagation()
    }

    activeRoot.addEventListener('pointerdown', handlePointerDown, true)
    activeRoot.addEventListener('click', handleClick, true)

    return () => {
      activeRoot.removeEventListener('pointerdown', handlePointerDown, true)
      activeRoot.removeEventListener('click', handleClick, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('pointercancel', handlePointerCancel, true)
      cancelGesture(true)
    }
  }, [disabled, onFolderOrder, onNoteOrder, onTagOrder, rootRef])

  return null
}
