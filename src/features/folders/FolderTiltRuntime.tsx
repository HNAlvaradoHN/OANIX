import { useEffect } from 'react'

const FOLDER_DETAILS_SELECTOR = '.oanix-folder-focus__details'
const MAX_ROTATE_X = 3.2
const MAX_ROTATE_Y = 4.8

export function FolderTiltRuntime() {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let activeCard: HTMLElement | null = null
    let pointerX = 0
    let pointerY = 0

    function clearCard(card: HTMLElement | null = activeCard) {
      if (!card) return
      card.style.removeProperty('transform')
      card.style.removeProperty('will-change')
      if (card === activeCard) activeCard = null
    }

    function applyTilt() {
      frame = 0
      const card = activeCard
      if (!card) return

      const rect = card.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const normalizedX = Math.max(-1, Math.min(1, ((pointerX - rect.left) / rect.width) * 2 - 1))
      const normalizedY = Math.max(-1, Math.min(1, ((pointerY - rect.top) / rect.height) * 2 - 1))
      const rotateX = -normalizedY * MAX_ROTATE_X
      const rotateY = normalizedX * MAX_ROTATE_Y

      card.style.willChange = 'transform'
      card.style.transform = `translateZ(40px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`
    }

    function queueTilt() {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(applyTilt)
    }

    function handlePointerMove(event: PointerEvent) {
      if (!finePointer.matches || reducedMotion.matches || (event.pointerType && event.pointerType !== 'mouse')) {
        clearCard()
        return
      }

      const card = event.target instanceof Element
        ? event.target.closest<HTMLElement>(FOLDER_DETAILS_SELECTOR)
        : null

      if (!card) {
        clearCard()
        return
      }

      if (activeCard !== card) {
        clearCard()
        activeCard = card
      }

      pointerX = event.clientX
      pointerY = event.clientY
      queueTilt()
    }

    function handlePointerOut(event: PointerEvent) {
      const card = event.target instanceof Element
        ? event.target.closest<HTMLElement>(FOLDER_DETAILS_SELECTOR)
        : null
      if (!card || card !== activeCard) return
      if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return
      clearCard(card)
    }

    function handleWindowBlur() {
      clearCard()
    }

    document.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.addEventListener('pointerout', handlePointerOut, { passive: true })
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame)
      clearCard()
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerout', handlePointerOut)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  return null
}
