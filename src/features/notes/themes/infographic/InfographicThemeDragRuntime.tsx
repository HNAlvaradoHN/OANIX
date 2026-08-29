import { useEffect, type RefObject } from 'react'

export type InfographicDragKind = 'folder' | 'tag' | 'note'

interface InfographicDragCallbacks {
  onFolderOrder: (ids: string[]) => void
  onTagOrder: (ids: string[]) => void
  onNoteOrder: (ids: string[]) => void
}

interface InfographicThemeDragRuntimeProps extends InfographicDragCallbacks {
  rootRef: RefObject<HTMLElement | null>
  disabled?: boolean
  onStatus?: (message: string) => void
}

type ActiveGesture = {
  pointerId: number
  kind: InfographicDragKind
  item: HTMLElement
  container: HTMLElement
  scrollContainer: HTMLElement
  startX: number
  startY: number
  lastX: number
  lastY: number
  lastMoveAt: number
  velocityX: number
  velocityY: number
  startScroll: number
  moved: boolean
  dragBlocked: boolean
  timer: number | null
  dragging: boolean
  ghost: HTMLElement | null
  ghostWidth: number
  ghostHeight: number
  scrollFrame: number | null
  initialOrder: string[]
  endAnchor: Element | null
  group: string
}

const LONG_PRESS_MS: Record<InfographicDragKind, number> = {
  folder: 500,
  tag: 400,
  note: 400,
}

const EDGE_ZONE: Record<InfographicDragKind, number> = {
  folder: 70,
  tag: 60,
  note: 70,
}

function itemSelector(kind: InfographicDragKind): string {
  return '[data-infographic-drag-kind="' + kind + '"][data-infographic-id]'
}

function draggableItems(container: HTMLElement, kind: InfographicDragKind, group = ''): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(itemSelector(kind)))
    .filter((item) => !group || (item.dataset.infographicGroup ?? '') === group)
}

function orderOf(container: HTMLElement, kind: InfographicDragKind): string[] {
  return draggableItems(container, kind)
    .flatMap((item) => item.dataset.infographicId ? [item.dataset.infographicId] : [])
}

function bulkSelectionActive(): boolean {
  return document.documentElement.classList.contains('oanix-note-bulk-selecting')
}

function blockOwnClick(root: HTMLElement, milliseconds = 520) {
  root.dataset.infographicSuppressClickUntil = String(performance.now() + milliseconds)
}

function clickIsBlocked(root: HTMLElement): boolean {
  return Number(root.dataset.infographicSuppressClickUntil ?? 0) > performance.now()
}

export function InfographicThemeDragRuntime({
  rootRef,
  onFolderOrder,
  onTagOrder,
  onNoteOrder,
  disabled = false,
  onStatus,
}: InfographicThemeDragRuntimeProps) {
  useEffect(() => {
    const candidateRoot = rootRef.current
    if (!candidateRoot || disabled) return
    const root = candidateRoot

    let gesture: ActiveGesture | null = null
    let momentumFrame: number | null = null

    function stopMomentum() {
      if (momentumFrame === null) return
      window.cancelAnimationFrame(momentumFrame)
      momentumFrame = null
    }

    function startMomentumScroll(
      kind: InfographicDragKind,
      scrollContainer: HTMLElement,
      velocityX: number,
      velocityY: number,
    ) {
      stopMomentum()
      let velocity = kind === 'note' ? velocityY : velocityX
      if (Math.abs(velocity) < 0.04) return

      let lastFrame = performance.now()
      const tick = (now: number) => {
        const elapsed = Math.min(34, Math.max(1, now - lastFrame))
        lastFrame = now
        const before = kind === 'note' ? scrollContainer.scrollTop : scrollContainer.scrollLeft

        if (kind === 'note') scrollContainer.scrollTop += velocity * elapsed
        else scrollContainer.scrollLeft += velocity * elapsed

        const after = kind === 'note' ? scrollContainer.scrollTop : scrollContainer.scrollLeft
        velocity *= Math.pow(0.93, elapsed / 16.67)

        if (Math.abs(velocity) < 0.02 || Math.abs(after - before) < 0.1) {
          momentumFrame = null
          return
        }
        momentumFrame = window.requestAnimationFrame(tick)
      }

      momentumFrame = window.requestAnimationFrame(tick)
    }

    function stopAutoScroll() {
      if (!gesture || gesture.scrollFrame === null) return
      window.cancelAnimationFrame(gesture.scrollFrame)
      gesture.scrollFrame = null
    }

    function moveGhost(x: number, y: number) {
      if (!gesture?.ghost) return
      gesture.ghost.style.left = String(x - gesture.ghostWidth / 2) + 'px'
      gesture.ghost.style.top = String(y - gesture.ghostHeight / 2) + 'px'
    }

    function targetAtPoint(x: number, y: number): HTMLElement | null {
      if (!gesture) return null
      if (gesture.ghost) gesture.ghost.style.display = 'none'
      const target = document.elementFromPoint(x, y)
        ?.closest<HTMLElement>(itemSelector(gesture.kind)) ?? null
      if (gesture.ghost) gesture.ghost.style.display = ''
      if (!target || target === gesture.item || target.parentElement !== gesture.container) return null
      if (gesture.group && (target.dataset.infographicGroup ?? '') !== gesture.group) return null
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
        const rect = gesture.scrollContainer.getBoundingClientRect()
        const zone = EDGE_ZONE[gesture.kind]
        let speed = 0

        if (gesture.kind === 'note') {
          if (gesture.lastY < rect.top + zone) {
            speed = -Math.min(20, (rect.top + zone - gesture.lastY) / 3 + 4)
          } else if (gesture.lastY > rect.bottom - zone) {
            speed = Math.min(20, (gesture.lastY - (rect.bottom - zone)) / 3 + 4)
          }
          if (speed !== 0) gesture.scrollContainer.scrollTop += speed
        } else {
          if (gesture.lastX < rect.left + zone) {
            speed = -Math.min(18, (rect.left + zone - gesture.lastX) / 3 + 4)
          } else if (gesture.lastX > rect.right - zone) {
            speed = Math.min(18, (gesture.lastX - (rect.right - zone)) / 3 + 4)
          }
          if (speed !== 0) gesture.scrollContainer.scrollLeft += speed
        }

        if (speed !== 0) reorderAtPoint(gesture.lastX, gesture.lastY)
        gesture.scrollFrame = window.requestAnimationFrame(tick)
      }

      gesture.scrollFrame = window.requestAnimationFrame(tick)
    }

    function setFolderJiggle(active: boolean) {
      const folders = root.querySelectorAll<HTMLElement>(itemSelector('folder'))
      folders.forEach((folder) => folder.classList.toggle('jiggle', active))
    }

    function beginDrag() {
      if (!gesture || gesture.dragging || gesture.moved || gesture.dragBlocked || bulkSelectionActive()) return
      gesture.timer = null
      gesture.dragging = true
      gesture.initialOrder = orderOf(gesture.container, gesture.kind)

      const rect = gesture.item.getBoundingClientRect()
      gesture.ghostWidth = rect.width
      gesture.ghostHeight = rect.height

      const ghost = gesture.item.cloneNode(true) as HTMLElement
      ghost.classList.add('oanix-infographic-drag-ghost')
      if (gesture.kind === 'folder') ghost.classList.add('dragging-active')
      ghost.removeAttribute('data-infographic-id')
      ghost.removeAttribute('data-infographic-drag-kind')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.style.width = String(rect.width) + 'px'
      ghost.style.minHeight = String(rect.height) + 'px'
      document.body.appendChild(ghost)
      gesture.ghost = ghost

      gesture.item.classList.add('oanix-infographic-drag-source')
      gesture.container.classList.add('oanix-infographic-dragging')
      document.documentElement.classList.add('oanix-infographic-' + gesture.kind + '-dragging')
      if (gesture.kind === 'folder') setFolderJiggle(true)

      window.getSelection()?.removeAllRanges()
      try {
        gesture.item.setPointerCapture(gesture.pointerId)
      } catch {
        // Pointer capture is best effort across Android WebView and PWA.
      }

      moveGhost(gesture.lastX, gesture.lastY)
      startAutoScroll()
      navigator.vibrate?.(gesture.kind === 'folder' ? 60 : gesture.kind === 'tag' ? 30 : 40)
      onStatus?.(gesture.kind === 'folder' ? 'Modo edición activado' : 'Reordenando…')
    }

    function clearGestureVisuals() {
      if (!gesture) return
      stopAutoScroll()
      gesture.ghost?.remove()
      try {
        if (gesture.item.hasPointerCapture(gesture.pointerId)) {
          gesture.item.releasePointerCapture(gesture.pointerId)
        }
      } catch {
        // Capture can already be gone after cancel/blur.
      }
      gesture.item.classList.remove('oanix-infographic-drag-source')
      gesture.container.classList.remove('oanix-infographic-dragging')
      document.documentElement.classList.remove('oanix-infographic-' + gesture.kind + '-dragging')
      if (gesture.kind === 'folder') setFolderJiggle(false)
    }

    function cancelGesture(restore = false) {
      if (!gesture) return
      if (gesture.timer !== null) window.clearTimeout(gesture.timer)
      if (restore && gesture.dragging) {
        const byId = new Map(
          draggableItems(gesture.container, gesture.kind)
            .flatMap((item) => item.dataset.infographicId
              ? [[item.dataset.infographicId, item] as const]
              : []),
        )
        gesture.initialOrder.forEach((id) => {
          const item = byId.get(id)
          if (item) gesture?.container.insertBefore(item, gesture.endAnchor)
        })
      }
      clearGestureVisuals()
      gesture = null
    }

    function persistGesture() {
      if (!gesture) return
      if (gesture.timer !== null) window.clearTimeout(gesture.timer)

      const kind = gesture.kind
      const wasDragging = gesture.dragging
      const wasMoved = gesture.moved
      const nextOrder = orderOf(gesture.container, kind)
      const changed = wasDragging && nextOrder.join(',') !== gesture.initialOrder.join(',')

      clearGestureVisuals()
      if (wasDragging || wasMoved) blockOwnClick(root)
      gesture = null

      if (!changed) return
      if (kind === 'folder') {
        onFolderOrder(nextOrder)
        onStatus?.('Posición de carpeta guardada')
      }
      if (kind === 'tag') {
        onTagOrder(nextOrder)
        onStatus?.('Etiqueta reordenada')
      }
      if (kind === 'note') {
        onNoteOrder(nextOrder)
        onStatus?.('Nota reordenada')
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return

      const now = performance.now()
      const elapsed = Math.max(1, now - gesture.lastMoveAt)
      const moveX = event.clientX - gesture.lastX
      const moveY = event.clientY - gesture.lastY
      gesture.velocityX = gesture.velocityX * 0.42 + (-moveX / elapsed) * 0.58
      gesture.velocityY = gesture.velocityY * 0.42 + (-moveY / elapsed) * 0.58
      gesture.lastMoveAt = now
      gesture.lastX = event.clientX
      gesture.lastY = event.clientY

      if (!gesture.dragging) {
        const dx = event.clientX - gesture.startX
        const dy = event.clientY - gesture.startY
        if (Math.hypot(dx, dy) <= 10) return

        gesture.moved = true
        if (gesture.timer !== null) window.clearTimeout(gesture.timer)
        gesture.timer = null

        if (event.pointerType !== 'mouse') {
          event.preventDefault()
          if (gesture.kind === 'note') {
            gesture.scrollContainer.scrollTop = gesture.startScroll - dy
          } else {
            gesture.scrollContainer.scrollLeft = gesture.startScroll - dx
          }
        }
        return
      }

      event.preventDefault()
      moveGhost(event.clientX, event.clientY)
      reorderAtPoint(event.clientX, event.clientY)
    }

    function removeHighFrequencyListeners() {
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('pointercancel', handlePointerCancel, true)
    }

    function handlePointerUp(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      const momentum = gesture.moved && !gesture.dragging && event.pointerType !== 'mouse'
        ? {
            kind: gesture.kind,
            scrollContainer: gesture.scrollContainer,
            velocityX: gesture.velocityX,
            velocityY: gesture.velocityY,
          }
        : null

      persistGesture()
      removeHighFrequencyListeners()

      if (momentum) {
        startMomentumScroll(
          momentum.kind,
          momentum.scrollContainer,
          momentum.velocityX,
          momentum.velocityY,
        )
      }
    }

    function handlePointerCancel(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      cancelGesture(true)
      removeHighFrequencyListeners()
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 || gesture) return
      const target = event.target
      if (!(target instanceof Element)) return

      const item = target.closest<HTMLElement>('[data-infographic-drag-kind][data-infographic-id]')
      if (!item || !root.contains(item)) return

      const kind = item.dataset.infographicDragKind as InfographicDragKind | undefined
      if (kind !== 'folder' && kind !== 'tag' && kind !== 'note') return

      const dragBlocked = bulkSelectionActive() || Boolean(
        target.closest('button, a, input, textarea, select, [contenteditable="true"]'),
      )
      if (dragBlocked) return

      const container = item.parentElement
      if (!container) return
      const scrollContainer = item.closest<HTMLElement>(
        '[data-infographic-scroll-kind="' + kind + '"]',
      ) ?? container
      stopMomentum()

      const initialItems = draggableItems(container, kind)
      const endAnchor = initialItems.at(-1)?.nextElementSibling ?? null

      gesture = {
        pointerId: event.pointerId,
        kind,
        item,
        container,
        scrollContainer,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastMoveAt: performance.now(),
        velocityX: 0,
        velocityY: 0,
        startScroll: kind === 'note' ? scrollContainer.scrollTop : scrollContainer.scrollLeft,
        moved: false,
        dragBlocked,
        timer: window.setTimeout(beginDrag, LONG_PRESS_MS[kind]),
        dragging: false,
        ghost: null,
        ghostWidth: 0,
        ghostHeight: 0,
        scrollFrame: null,
        initialOrder: [],
        endAnchor,
        group: item.dataset.infographicGroup ?? '',
      }

      document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
      document.addEventListener('pointerup', handlePointerUp, true)
      document.addEventListener('pointercancel', handlePointerCancel, true)
    }

    function handleClick(event: MouseEvent) {
      if (!clickIsBlocked(root)) return
      event.preventDefault()
      event.stopPropagation()
    }

    function blockNativeLongPress(event: Event) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('[data-infographic-drag-kind][data-infographic-id]')) return
      event.preventDefault()
    }

    function handleVisibilityChange() {
      if (document.hidden) cancelGesture(true)
    }

    function handleBlur() {
      cancelGesture(true)
    }

    root.addEventListener('pointerdown', handlePointerDown, true)
    root.addEventListener('click', handleClick, true)
    root.addEventListener('contextmenu', blockNativeLongPress, true)
    root.addEventListener('selectstart', blockNativeLongPress, true)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)

    return () => {
      root.removeEventListener('pointerdown', handlePointerDown, true)
      root.removeEventListener('click', handleClick, true)
      root.removeEventListener('contextmenu', blockNativeLongPress, true)
      root.removeEventListener('selectstart', blockNativeLongPress, true)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      removeHighFrequencyListeners()
      stopMomentum()
      cancelGesture(true)
    }
  }, [disabled, onFolderOrder, onNoteOrder, onStatus, onTagOrder, rootRef])

  return null
}
