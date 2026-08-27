import { useEffect } from 'react'
import './pwa-image-preview.css'

const IMAGE_CARD_SELECTOR = '.image-note-editor-root .editor-image-block[data-image-block="true"]'
const DESCRIPTION_LIMIT = 56
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const HISTORY_KEY = '__oanixPwaImageOverlay'
const LIGHTBOX_SELECTOR = '.image-lightbox'

function mutationTouchesImagePreview(record: MutationRecord): boolean {
  const target = record.target
  if (target instanceof Element) {
    if (
      target.matches(IMAGE_CARD_SELECTOR)
      || target.closest(IMAGE_CARD_SELECTOR)
      || target.matches(LIGHTBOX_SELECTOR)
      || target.closest(LIGHTBOX_SELECTOR)
    ) return true
  }

  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
  return nodes.some((node) => {
    if (!(node instanceof Element)) return false
    return (
      node.matches(IMAGE_CARD_SELECTOR)
      || node.querySelector(IMAGE_CARD_SELECTOR) !== null
      || node.matches(LIGHTBOX_SELECTOR)
      || node.querySelector(LIGHTBOX_SELECTOR) !== null
    )
  })
}

type TouchPoint = { x: number; y: number }

type PanState = {
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
  viewport: HTMLElement
}

function pointDistance(left: TouchPoint, right: TouchPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

function scaleFromImage(image: HTMLImageElement | null): number {
  const match = image?.style.transform.match(/scale\((\d+(?:\.\d+)?)\)/)
  const value = match ? Number(match[1]) : 1
  return Number.isFinite(value) ? value : 1
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function PwaImagePreviewRuntime() {
  useEffect(() => {
    document.documentElement.classList.add('oanix-pwa-image-preview-v1')

    const appRoot = document.getElementById('root')
    if (!appRoot) return

    let descriptionBubble: HTMLElement | null = null
    let currentLightbox: HTMLElement | null = null
    let overlayHistoryToken: string | null = null
    let pendingHistoryClose: (() => void) | null = null
    let closingFromHistory = false
    let normalizeQueued = false
    const touchPoints = new Map<number, TouchPoint>()
    let pinchStartDistance = 0
    let pinchStartScale = 1
    let panState: PanState | null = null
    let gestureListenersAttached = false

    function descriptionNeedsMore(input: HTMLInputElement): boolean {
      return input.value.trim().length > DESCRIPTION_LIMIT
    }

    function updateDescriptionMore(input: HTMLInputElement) {
      const row = input.closest<HTMLElement>('[data-pwa-image-description-row="true"]')
      const more = row?.querySelector<HTMLButtonElement>('[data-pwa-image-description-more="true"]')
      if (!row || !more) return

      const shouldShow = descriptionNeedsMore(input)
      if (more.hidden !== !shouldShow) more.hidden = !shouldShow
      row.dataset.descriptionOverflow = String(shouldShow)
    }

    function normalizeFigure(figure: HTMLElement) {
      figure.dataset.pwaImageCard = 'true'
      figure.dataset.imageSelected = 'false'
      figure.style.removeProperty('translate')

      const preview = figure.querySelector<HTMLElement>('[data-image-preview="true"]')
      const footer = figure.querySelector<HTMLElement>('.editor-image-block__footer')
      const actions = figure.querySelector<HTMLElement>('.editor-image-block__actions')
      const details = figure.querySelector<HTMLElement>('.editor-image-block__details')
      const meta = figure.querySelector<HTMLElement>('.editor-image-block__meta')
      const input = figure.querySelector<HTMLInputElement>('[data-image-alt="true"]')
      if (!preview || !footer || !actions || !details || !input) return

      let top = figure.querySelector<HTMLElement>('[data-pwa-image-top="true"]')
      if (!top) {
        top = document.createElement('div')
        top.className = 'pwa-image-card__top'
        top.dataset.pwaImageTop = 'true'
        figure.insertBefore(top, figure.firstChild)
      }

      if (preview.parentElement !== top) top.append(preview)
      if (actions.parentElement !== top) top.append(actions)
      if (meta && meta.parentElement !== actions) actions.prepend(meta)

      if (footer.parentElement !== figure) figure.append(footer)
      if (details.parentElement !== footer) footer.append(details)

      let descriptionRow = details.querySelector<HTMLElement>('[data-pwa-image-description-row="true"]')
      if (!descriptionRow) {
        descriptionRow = document.createElement('div')
        descriptionRow.className = 'pwa-image-card__description-row'
        descriptionRow.dataset.pwaImageDescriptionRow = 'true'
        details.append(descriptionRow)
      }

      if (input.parentElement !== descriptionRow) descriptionRow.append(input)

      let more = descriptionRow.querySelector<HTMLButtonElement>('[data-pwa-image-description-more="true"]')
      if (!more) {
        more = document.createElement('button')
        more.type = 'button'
        more.className = 'pwa-image-card__description-more'
        more.dataset.pwaImageDescriptionMore = 'true'
        more.textContent = '+'
        more.title = 'Leer descripción completa'
        more.setAttribute('aria-label', 'Leer descripción completa de la imagen')
        descriptionRow.append(more)
      }

      updateDescriptionMore(input)
    }

    function normalizeAllFigures() {
      document.querySelectorAll<HTMLElement>(IMAGE_CARD_SELECTOR).forEach(normalizeFigure)
    }

    function queueNormalize() {
      if (normalizeQueued) return
      normalizeQueued = true
      queueMicrotask(() => {
        normalizeQueued = false
        normalizeAllFigures()
        syncLightbox()
      })
    }

    function currentHistoryOwnsOverlay(): boolean {
      if (!overlayHistoryToken) return false
      const state = history.state as Record<string, unknown> | null
      return state?.[HISTORY_KEY] === overlayHistoryToken
    }

    function pushOverlayHistory(kind: 'description' | 'lightbox') {
      if (overlayHistoryToken) return
      const token = `${kind}:${Date.now()}:${Math.random().toString(36).slice(2)}`
      const currentState = history.state && typeof history.state === 'object'
        ? history.state as Record<string, unknown>
        : {}
      overlayHistoryToken = token
      history.pushState({ ...currentState, [HISTORY_KEY]: token }, '')
    }

    function requestOverlayClose(close: () => void) {
      if (currentHistoryOwnsOverlay()) {
        pendingHistoryClose = close
        history.back()
        return
      }
      close()
    }

    function removeDescriptionBubble() {
      descriptionBubble?.remove()
      descriptionBubble = null
    }

    function openDescriptionBubble(input: HTMLInputElement) {
      const text = input.value.trim()
      if (!text) return

      removeDescriptionBubble()

      const overlay = document.createElement('div')
      overlay.className = 'pwa-image-description-overlay'
      overlay.dataset.pwaImageDescriptionOverlay = 'true'
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
      overlay.setAttribute('aria-label', 'Descripción completa de la imagen')

      const bubble = document.createElement('div')
      bubble.className = 'pwa-image-description-bubble'

      const heading = document.createElement('div')
      heading.className = 'pwa-image-description-bubble__heading'

      const title = document.createElement('strong')
      title.textContent = 'Descripción'

      const close = document.createElement('button')
      close.type = 'button'
      close.dataset.pwaImageDescriptionClose = 'true'
      close.textContent = '×'
      close.title = 'Cerrar descripción'
      close.setAttribute('aria-label', 'Cerrar descripción completa')

      const body = document.createElement('p')
      body.className = 'pwa-image-description-bubble__text'
      body.textContent = text

      heading.append(title, close)
      bubble.append(heading, body)
      overlay.append(bubble)
      document.body.append(overlay)
      descriptionBubble = overlay
      pushOverlayHistory('description')
      close.focus()
    }

    function lightboxImage(lightbox: HTMLElement | null = currentLightbox): HTMLImageElement | null {
      return lightbox?.querySelector<HTMLImageElement>('.image-lightbox__viewport img') ?? null
    }

    function setLightboxScale(lightbox: HTMLElement, scale: number) {
      const image = lightboxImage(lightbox)
      if (!image) return
      const next = clampZoom(Number(scale.toFixed(2)))
      image.style.transform = `scale(${next})`
      const label = lightbox.querySelector<HTMLElement>('.image-lightbox__zoom-label')
      if (label) label.textContent = `${Math.round(next * 100)}%`
    }

    function closeLightboxDirect(lightbox: HTMLElement) {
      const close = lightbox.querySelector<HTMLButtonElement>('.image-lightbox__close')
      if (!close) return
      closingFromHistory = true
      close.click()
      queueMicrotask(() => {
        closingFromHistory = false
      })
    }

    function attachGestureListeners() {
      if (gestureListenersAttached) return
      gestureListenersAttached = true
      document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
      document.addEventListener('pointerup', handlePointerEnd, true)
      document.addEventListener('pointercancel', handlePointerEnd, true)
    }

    function detachGestureListeners() {
      if (!gestureListenersAttached) return
      gestureListenersAttached = false
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerEnd, true)
      document.removeEventListener('pointercancel', handlePointerEnd, true)
    }

    function clearTouchState() {
      touchPoints.clear()
      pinchStartDistance = 0
      pinchStartScale = 1
      panState = null
      detachGestureListeners()
    }

    function syncLightbox() {
      const next = document.querySelector<HTMLElement>('.image-lightbox')
      if (next && next !== currentLightbox) {
        currentLightbox = next
        clearTouchState()
        pushOverlayHistory('lightbox')
        return
      }

      if (!next && currentLightbox) {
        currentLightbox = null
        clearTouchState()
        if (currentHistoryOwnsOverlay() && !pendingHistoryClose && !closingFromHistory) {
          pendingHistoryClose = () => undefined
          history.back()
        }
      }
    }

    function handlePopState() {
      const pending = pendingHistoryClose
      pendingHistoryClose = null
      overlayHistoryToken = null

      if (pending) {
        pending()
        return
      }

      if (descriptionBubble) {
        removeDescriptionBubble()
        return
      }

      if (currentLightbox) closeLightboxDirect(currentLightbox)
    }

    function handleInput(event: Event) {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.dataset.imageAlt !== 'true') return
      updateDescriptionMore(target)

      if (descriptionBubble) {
        const text = descriptionBubble.querySelector<HTMLElement>('.pwa-image-description-bubble__text')
        if (text) text.textContent = target.value.trim()
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const viewport = target.closest<HTMLElement>('.image-lightbox__viewport')
      if (viewport && currentLightbox?.contains(viewport) && event.pointerType === 'touch') {
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
        attachGestureListeners()
        const image = lightboxImage()

        if (touchPoints.size === 1 && scaleFromImage(image) > 1) {
          panState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: viewport.scrollLeft,
            scrollTop: viewport.scrollTop,
            viewport,
          }
        }

        if (touchPoints.size === 2) {
          const [left, right] = Array.from(touchPoints.values())
          pinchStartDistance = Math.max(1, pointDistance(left, right))
          pinchStartScale = scaleFromImage(image)
          panState = null
        }
        return
      }

      const preview = target.closest<HTMLElement>('[data-image-preview="true"]')
      if (preview?.closest(IMAGE_CARD_SELECTOR)) {
        // Stop the shared editor before it can begin its legacy image-drag gesture.
        event.stopPropagation()
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (!touchPoints.has(event.pointerId) || !currentLightbox) return
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (touchPoints.size >= 2) {
        const [left, right] = Array.from(touchPoints.values())
        const distance = Math.max(1, pointDistance(left, right))
        event.preventDefault()
        setLightboxScale(currentLightbox, pinchStartScale * (distance / pinchStartDistance))
        return
      }

      if (panState?.pointerId === event.pointerId && scaleFromImage(lightboxImage()) > 1) {
        event.preventDefault()
        panState.viewport.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX)
        panState.viewport.scrollTop = panState.scrollTop - (event.clientY - panState.startY)
      }
    }

    function handlePointerEnd(event: PointerEvent) {
      touchPoints.delete(event.pointerId)
      if (panState?.pointerId === event.pointerId) panState = null
      if (touchPoints.size < 2) {
        pinchStartDistance = 0
        pinchStartScale = scaleFromImage(lightboxImage())
      }
      if (touchPoints.size === 0) detachGestureListeners()
    }

    function handleClick(event: MouseEvent) {
      if (closingFromHistory) return
      const target = event.target
      if (!(target instanceof Element)) return

      const more = target.closest<HTMLButtonElement>('[data-pwa-image-description-more="true"]')
      if (more) {
        const row = more.closest<HTMLElement>('[data-pwa-image-description-row="true"]')
        const input = row?.querySelector<HTMLInputElement>('[data-image-alt="true"]')
        if (!input) return
        event.preventDefault()
        event.stopPropagation()
        openDescriptionBubble(input)
        return
      }

      const descriptionClose = target.closest<HTMLButtonElement>('[data-pwa-image-description-close="true"]')
      if (descriptionClose && descriptionBubble) {
        event.preventDefault()
        event.stopPropagation()
        requestOverlayClose(removeDescriptionBubble)
        return
      }

      if (descriptionBubble && target === descriptionBubble) {
        event.preventDefault()
        event.stopPropagation()
        requestOverlayClose(removeDescriptionBubble)
        return
      }

      const preview = target.closest<HTMLElement>('[data-image-preview="true"]')
      const figure = preview?.closest<HTMLElement>(IMAGE_CARD_SELECTOR)
      if (preview && figure) {
        const open = figure.querySelector<HTMLButtonElement>('[data-image-open-action="true"]')
        if (!open) return
        event.preventDefault()
        event.stopPropagation()
        open.click()
        return
      }

      if (currentLightbox) {
        const close = target.closest<HTMLButtonElement>('.image-lightbox__close')
        const clickedBackdrop = target === currentLightbox
        if (close || clickedBackdrop) {
          event.preventDefault()
          event.stopPropagation()
          requestOverlayClose(() => closeLightboxDirect(currentLightbox!))
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (descriptionBubble) {
        event.preventDefault()
        event.stopImmediatePropagation()
        requestOverlayClose(removeDescriptionBubble)
        return
      }

      if (currentLightbox) {
        event.preventDefault()
        event.stopImmediatePropagation()
        requestOverlayClose(() => closeLightboxDirect(currentLightbox!))
      }
    }

    const observer = new MutationObserver((records) => {
      if (records.some(mutationTouchesImagePreview)) queueNormalize()
    })
    observer.observe(appRoot, { childList: true, subtree: true })

    normalizeAllFigures()
    syncLightbox()

    document.addEventListener('input', handleInput, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('resize', queueNormalize)

    return () => {
      observer.disconnect()
      document.removeEventListener('input', handleInput, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('resize', queueNormalize)
      removeDescriptionBubble()
      clearTouchState()
      document.documentElement.classList.remove('oanix-pwa-image-preview-v1')
    }
  }, [])

  return null
}
