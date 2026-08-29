import { useEffect } from 'react'

const LIGHTBOX_VIEWPORT_SELECTOR = '.image-lightbox__viewport'
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const MIDDLE_BUTTON = 1
const WHEEL_DELTA_LINE = 1
const WHEEL_DELTA_PAGE = 2

type MousePanState = {
  pointerId: number
  viewport: HTMLElement
  startX: number
  startY: number
  startScrollLeft: number
  startScrollTop: number
  startScale: number
  moved: boolean
}

function imageForViewport(viewport: HTMLElement): HTMLImageElement | null {
  return viewport.querySelector<HTMLImageElement>('img')
}

function scaleFromImage(image: HTMLImageElement | null): number {
  const match = image?.style.transform.match(/scale\((\d+(?:\.\d+)?)\)/)
  const value = match ? Number(match[1]) : 1
  return Number.isFinite(value) ? value : 1
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function setViewportScale(viewport: HTMLElement, scale: number): number {
  const lightbox = viewport.closest<HTMLElement>('.image-lightbox')
  const image = imageForViewport(viewport)
  if (!lightbox || !image) return 1

  const next = clampZoom(Number(scale.toFixed(2)))
  image.style.transform = `scale(${next})`
  const label = lightbox.querySelector<HTMLElement>('.image-lightbox__zoom-label')
  if (label) label.textContent = `${Math.round(next * 100)}%`

  viewport.dataset.desktopMouseZoom = next > 1 ? 'true' : 'false'
  viewport.style.cursor = next > 1 ? 'grab' : 'zoom-in'
  if (next <= 1) {
    viewport.scrollLeft = 0
    viewport.scrollTop = 0
  }
  return next
}

function viewportFromTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>(LIGHTBOX_VIEWPORT_SELECTOR)
    : null
}

export function DesktopImageViewportRuntime() {
  useEffect(() => {
    let lastPointerType = ''
    let panState: MousePanState | null = null

    function handlePointerDown(event: PointerEvent) {
      lastPointerType = event.pointerType
      if (event.pointerType !== 'mouse' || event.button !== MIDDLE_BUTTON) return

      const viewport = viewportFromTarget(event.target)
      if (!viewport || !viewport.closest('.image-lightbox') || !imageForViewport(viewport)) return

      event.preventDefault()
      event.stopPropagation()
      panState = {
        pointerId: event.pointerId,
        viewport,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: viewport.scrollLeft,
        startScrollTop: viewport.scrollTop,
        startScale: scaleFromImage(imageForViewport(viewport)),
        moved: false,
      }
      viewport.style.cursor = 'grabbing'
      try {
        viewport.setPointerCapture(event.pointerId)
      } catch {
        // Pointer capture is an enhancement; document listeners still keep the gesture usable.
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const state = panState
      if (!state || event.pointerId !== state.pointerId || event.pointerType !== 'mouse') return

      const deltaX = event.clientX - state.startX
      const deltaY = event.clientY - state.startY
      if (!state.moved && Math.hypot(deltaX, deltaY) > 3) {
        state.moved = true
        if (state.startScale <= 1) setViewportScale(state.viewport, 2)
      }
      if (!state.moved) return

      event.preventDefault()
      event.stopPropagation()
      state.viewport.scrollLeft = state.startScrollLeft - deltaX
      state.viewport.scrollTop = state.startScrollTop - deltaY
    }

    function finishPan(event: PointerEvent) {
      const state = panState
      if (!state || event.pointerId !== state.pointerId) return
      panState = null

      event.preventDefault()
      event.stopPropagation()
      if (!state.moved) {
        setViewportScale(state.viewport, state.startScale > 1 ? 1 : 2)
      } else {
        const scale = scaleFromImage(imageForViewport(state.viewport))
        state.viewport.style.cursor = scale > 1 ? 'grab' : 'zoom-in'
      }

      try {
        state.viewport.releasePointerCapture(event.pointerId)
      } catch {
        // The pointer may already have been released by the browser.
      }
    }

    function handleWheel(event: WheelEvent) {
      const viewport = viewportFromTarget(event.target)
      if (!viewport || !viewport.closest('.image-lightbox')) return
      const image = imageForViewport(viewport)
      if (!image) return

      event.preventDefault()
      event.stopPropagation()
      const current = scaleFromImage(image)
      const normalizedDelta = event.deltaMode === WHEEL_DELTA_LINE
        ? event.deltaY * 18
        : event.deltaMode === WHEEL_DELTA_PAGE
          ? event.deltaY * 180
          : event.deltaY
      const factor = Math.exp(-normalizedDelta * 0.0015)
      setViewportScale(viewport, current * factor)
    }

    function handleAuxClick(event: MouseEvent) {
      if (event.button !== MIDDLE_BUTTON || !viewportFromTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    function handleDoubleClick(event: MouseEvent) {
      if (lastPointerType !== 'mouse' || !viewportFromTarget(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', finishPan, true)
    document.addEventListener('pointercancel', finishPan, true)
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    document.addEventListener('auxclick', handleAuxClick, true)
    document.addEventListener('dblclick', handleDoubleClick, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', finishPan, true)
      document.removeEventListener('pointercancel', finishPan, true)
      document.removeEventListener('wheel', handleWheel, true)
      document.removeEventListener('auxclick', handleAuxClick, true)
      document.removeEventListener('dblclick', handleDoubleClick, true)
    }
  }, [])

  return null
}
