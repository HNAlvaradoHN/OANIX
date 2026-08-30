import { useEffect } from 'react'
import './pwa-image-preview.css'

const IMAGE_CARD_SELECTOR = '.image-note-editor-root .editor-image-block[data-image-block="true"]'
const CONTACT_CARD_SELECTOR = '.image-note-editor-root .editor-contact-card[data-contact-block="true"]'
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
      || target.matches(CONTACT_CARD_SELECTOR)
      || target.closest(CONTACT_CARD_SELECTOR)
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
      || node.matches(CONTACT_CARD_SELECTOR)
      || node.querySelector(CONTACT_CARD_SELECTOR) !== null
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
  const runtimeScale = Number(image?.dataset.pwaZoom)
  if (Number.isFinite(runtimeScale) && runtimeScale >= MIN_ZOOM) return runtimeScale
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

    function editableValue(input: HTMLElement): string {
      if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) return input.value.trim()
      return (input.innerText ?? '').trim()
    }

    function descriptionValue(input: HTMLElement): string {
      return editableValue(input)
    }

    function descriptionNeedsMore(input: HTMLElement): boolean {
      return descriptionValue(input).length > DESCRIPTION_LIMIT
    }

    function updateDescriptionMore(input: HTMLElement) {
      const row = input.closest<HTMLElement>('[data-pwa-image-description-row="true"]')
      const more = row?.querySelector<HTMLButtonElement>('[data-pwa-image-description-more="true"]')
      if (!row || !more) return

      const shouldShow = descriptionNeedsMore(input)
      if (more.hidden !== !shouldShow) more.hidden = !shouldShow
      row.dataset.descriptionOverflow = String(shouldShow)
    }

    function updateContactMore(notes: HTMLTextAreaElement) {
      const row = notes.closest<HTMLElement>('[data-pwa-contact-notes-row="true"]')
      const more = row?.querySelector<HTMLButtonElement>('[data-pwa-contact-notes-more="true"]')
      if (!row || !more) return
      const shouldShow = notes.value.trim().length > 70 || notes.scrollHeight > notes.clientHeight + 2
      more.hidden = !shouldShow
      row.dataset.contactOverflow = String(shouldShow)
    }

    function normalizeContact(card: HTMLElement) {
      card.dataset.pwaContactCard = 'true'
      const notes = card.querySelector<HTMLTextAreaElement>('textarea[data-contact-field="notes"]')
        ?? card.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')
        ?? card.querySelector<HTMLTextAreaElement>('textarea')
      if (!notes) return

      notes.rows = 2
      notes.dataset.pwaContactNotes = 'true'
      let row = notes.closest<HTMLElement>('[data-pwa-contact-notes-row="true"]')
      if (!row) {
        row = document.createElement('div')
        row.className = 'pwa-contact-notes-row'
        row.dataset.pwaContactNotesRow = 'true'
        notes.parentElement?.insertBefore(row, notes)
        row.append(notes)
      }

      let more = row.querySelector<HTMLButtonElement>('[data-pwa-contact-notes-more="true"]')
      if (!more) {
        more = document.createElement('button')
        more.type = 'button'
        more.className = 'pwa-contact-notes-more'
        more.dataset.pwaContactNotesMore = 'true'
        more.textContent = 'Ver todo'
        more.title = 'Ver todas las notas del contacto'
        more.setAttribute('aria-label', 'Ver todo el texto de notas del contacto')
        row.append(more)
      }
      updateContactMore(notes)
    }

    function normalizeFigure(figure: HTMLElement) {
      figure.dataset.pwaImageCard = 'true'
      figure.dataset.imageSelected = 'false'
      figure.dataset.pwaActionsOpen ??= 'false'
      figure.style.removeProperty('translate')

      const preview = figure.querySelector<HTMLElement>('[data-image-preview="true"]')
      const footer = figure.querySelector<HTMLElement>('.editor-image-block__footer')
      const actions = figure.querySelector<HTMLElement>('.editor-image-block__actions')
      const details = figure.querySelector<HTMLElement>('.editor-image-block__details')
      const meta = figure.querySelector<HTMLElement>('.editor-image-block__meta')
      const input = figure.querySelector<HTMLElement>('[data-image-alt="true"]')
      if (!preview || !footer || !actions || !details || !input) return

      let menuToggle = figure.querySelector<HTMLButtonElement>('[data-pwa-image-menu-toggle="true"]')
      if (!menuToggle) {
        menuToggle = document.createElement('button')
        menuToggle.type = 'button'
        menuToggle.className = 'pwa-image-card__menu-toggle'
        menuToggle.dataset.pwaImageMenuToggle = 'true'
        menuToggle.textContent = '⋯'
        menuToggle.title = 'Acciones de la imagen'
        menuToggle.setAttribute('aria-label', 'Abrir acciones de la imagen')
        menuToggle.setAttribute('aria-expanded', 'false')
        figure.append(menuToggle)
      }

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
      document.querySelectorAll<HTMLElement>(CONTACT_CARD_SELECTOR).forEach(normalizeContact)
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

    function openTextBubble(text: string, headingText: string, ariaLabel: string) {
      if (!text) return
      removeDescriptionBubble()

      const overlay = document.createElement('div')
      overlay.className = 'pwa-image-description-overlay'
      overlay.dataset.pwaImageDescriptionOverlay = 'true'
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
      overlay.setAttribute('aria-label', ariaLabel)

      const bubble = document.createElement('div')
      bubble.className = 'pwa-image-description-bubble'
      const heading = document.createElement('div')
      heading.className = 'pwa-image-description-bubble__heading'
      const title = document.createElement('strong')
      title.textContent = headingText
      const close = document.createElement('button')
      close.type = 'button'
      close.dataset.pwaImageDescriptionClose = 'true'
      close.textContent = '×'
      close.title = 'Cerrar'
      close.setAttribute('aria-label', 'Cerrar texto completo')
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

    function openDescriptionBubble(input: HTMLElement) {
      openTextBubble(descriptionValue(input), 'Descripción', 'Descripción completa de la imagen')
    }

    function lightboxImage(lightbox: HTMLElement | null = currentLightbox): HTMLImageElement | null {
      return lightbox?.querySelector<HTMLImageElement>('.image-lightbox__viewport img') ?? null
    }

    function ensureLayoutZoomBase(image: HTMLImageElement) {
      if (image.dataset.pwaBaseWidth) return
      const transform = image.style.transform
      image.style.transform = 'none'
      const baseWidth = Math.max(1, image.getBoundingClientRect().width)
      image.dataset.pwaBaseWidth = String(baseWidth)
      image.style.transform = transform
    }

    function setLightboxScale(lightbox: HTMLElement, scale: number) {
      const image = lightboxImage(lightbox)
      if (!image) return
      const next = clampZoom(Number(scale.toFixed(2)))
      ensureLayoutZoomBase(image)
      const baseWidth = Number(image.dataset.pwaBaseWidth) || image.getBoundingClientRect().width
      image.dataset.pwaZoom = String(next)
      image.style.transform = 'none'
      image.style.width = `${Math.round(baseWidth * next)}px`
      image.style.maxWidth = 'none'
      image.style.maxHeight = 'none'
      image.style.height = 'auto'
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
        queueMicrotask(() => setLightboxScale(next, 1))
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
      if (!(target instanceof Element)) return
      const input = target.closest<HTMLElement>('[data-image-alt="true"]')
      if (input?.closest(IMAGE_CARD_SELECTOR)) {
        updateDescriptionMore(input)
        if (descriptionBubble) {
          const text = descriptionBubble.querySelector<HTMLElement>('.pwa-image-description-bubble__text')
          if (text) text.textContent = descriptionValue(input)
        }
        return
      }
      const contactNotes = target.closest<HTMLTextAreaElement>('[data-pwa-contact-notes="true"]')
      if (contactNotes) updateContactMore(contactNotes)
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
      if (preview?.closest(IMAGE_CARD_SELECTOR)) event.stopPropagation()
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

    function handleDoubleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element) || !currentLightbox) return
      if (!target.closest('.image-lightbox__viewport img')) return
      event.preventDefault()
      event.stopPropagation()
      setLightboxScale(currentLightbox, scaleFromImage(lightboxImage()) > 1 ? 1 : 2)
    }

    function handleClick(event: MouseEvent) {
      if (closingFromHistory) return
      const target = event.target
      if (!(target instanceof Element)) return

      const imageMenu = target.closest<HTMLButtonElement>('[data-pwa-image-menu-toggle="true"]')
      if (imageMenu) {
        const figure = imageMenu.closest<HTMLElement>(IMAGE_CARD_SELECTOR)
        if (!figure) return
        event.preventDefault()
        event.stopPropagation()
        const opening = figure.dataset.pwaActionsOpen !== 'true'
        document.querySelectorAll<HTMLElement>(IMAGE_CARD_SELECTOR).forEach((other) => {
          if (other !== figure) other.dataset.pwaActionsOpen = 'false'
          other.querySelector<HTMLButtonElement>('[data-pwa-image-menu-toggle="true"]')?.setAttribute('aria-expanded', String(other === figure && opening))
        })
        figure.dataset.pwaActionsOpen = String(opening)
        imageMenu.setAttribute('aria-expanded', String(opening))
        return
      }

      const contactMore = target.closest<HTMLButtonElement>('[data-pwa-contact-notes-more="true"]')
      if (contactMore) {
        const row = contactMore.closest<HTMLElement>('[data-pwa-contact-notes-row="true"]')
        const notes = row?.querySelector<HTMLTextAreaElement>('[data-pwa-contact-notes="true"]')
        if (!notes) return
        event.preventDefault()
        event.stopPropagation()
        openTextBubble(notes.value.trim(), 'Notas del contacto', 'Texto completo de notas del contacto')
        return
      }

      if (currentLightbox) {
        const zoomIn = target.closest<HTMLButtonElement>('[aria-label="Acercar imagen"]')
        const zoomOut = target.closest<HTMLButtonElement>('[aria-label="Alejar imagen"]')
        const zoomReset = target.closest<HTMLButtonElement>('.image-lightbox__zoom-label')
        if (zoomIn || zoomOut || zoomReset) {
          event.preventDefault()
          event.stopPropagation()
          const current = scaleFromImage(lightboxImage())
          setLightboxScale(currentLightbox, zoomReset ? 1 : current + (zoomIn ? 0.25 : -0.25))
          return
        }
      }

      const more = target.closest<HTMLButtonElement>('[data-pwa-image-description-more="true"]')
      if (more) {
        const row = more.closest<HTMLElement>('[data-pwa-image-description-row="true"]')
        const input = row?.querySelector<HTMLElement>('[data-image-alt="true"]')
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
    document.addEventListener('dblclick', handleDoubleClick, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('resize', queueNormalize)

    return () => {
      observer.disconnect()
      document.removeEventListener('input', handleInput, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('dblclick', handleDoubleClick, true)
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
