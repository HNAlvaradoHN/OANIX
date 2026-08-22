import { useEffect } from 'react'
import './folderKineticSlide.css'

const SETTLE_MS = 140
const CARD_SELECTOR = '.oanix-folder-card--custom'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function FolderKineticSlideRuntime() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let container: HTMLElement | null = null
    let frame = 0
    let settleTimer = 0
    let mutationFrame = 0
    let lastScrollTop = 0
    let velocity = 0

    const cards = () => container
      ? Array.from(container.querySelectorAll<HTMLElement>(CARD_SELECTOR))
      : []

    const clearCardTransforms = () => {
      cards().forEach((card) => {
        delete card.dataset.oanixKinetic
        card.style.removeProperty('transform')
        card.style.removeProperty('opacity')
        card.style.removeProperty('--oanix-slide-depth')
      })
    }

    const paint = () => {
      frame = 0
      if (!container || media.matches) return

      const viewport = container.getBoundingClientRect()
      const center = viewport.top + viewport.height / 2
      const range = Math.max(viewport.height * 0.72, 1)
      const time = performance.now() / 1000

      cards().forEach((card, index) => {
        const rect = card.getBoundingClientRect()
        const cardCenter = rect.top + rect.height / 2
        const signed = clamp((cardCenter - center) / range, -1, 1)
        const distance = Math.abs(signed)
        const eased = Math.pow(distance, 0.88)
        const scale = 1 - eased * 0.155
        const compression = -signed * eased * 42
        const float = Math.sin(time * 2.15 + index * 0.82) * 1.25 * (1 - distance)
        const rotateX = signed * eased * 16 + velocity * 0.035
        const opacity = clamp(1 - Math.pow(distance, 1.55) * 0.56, 0.44, 1)

        card.dataset.oanixKinetic = 'true'
        card.style.setProperty('--oanix-slide-depth', String(1 - distance))
        card.style.transform = `translate3d(0, ${compression + float}px, 0) scale(${scale}) rotateX(${rotateX}deg)`
        card.style.opacity = String(opacity)
      })
    }

    const schedulePaint = () => {
      if (frame || media.matches) return
      frame = window.requestAnimationFrame(paint)
    }

    const settle = () => {
      if (!container || media.matches) return
      velocity *= 0.34
      schedulePaint()
      if (Math.abs(velocity) > 0.08) {
        settleTimer = window.setTimeout(settle, 32)
      }
    }

    const onScroll = () => {
      if (!container || media.matches) return
      const next = container.scrollTop
      velocity = clamp(next - lastScrollTop, -32, 32)
      lastScrollTop = next
      schedulePaint()
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(settle, SETTLE_MS)
    }

    const onPointerMove = () => schedulePaint()

    const bind = () => {
      const next = document.querySelector<HTMLElement>('.oanix-folder-grid__cards')
      if (next === container) {
        schedulePaint()
        return
      }

      if (container) {
        container.removeEventListener('scroll', onScroll)
        container.removeEventListener('pointermove', onPointerMove)
        clearCardTransforms()
      }

      container = next
      if (!container) return
      lastScrollTop = container.scrollTop
      container.addEventListener('scroll', onScroll, { passive: true })
      container.addEventListener('pointermove', onPointerMove, { passive: true })
      schedulePaint()
    }

    const onMotionPreferenceChange = () => {
      if (media.matches) clearCardTransforms()
      else schedulePaint()
    }

    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(mutationFrame)
      mutationFrame = window.requestAnimationFrame(bind)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    media.addEventListener('change', onMotionPreferenceChange)
    window.addEventListener('resize', schedulePaint, { passive: true })
    bind()

    return () => {
      observer.disconnect()
      media.removeEventListener('change', onMotionPreferenceChange)
      window.removeEventListener('resize', schedulePaint)
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(mutationFrame)
      window.clearTimeout(settleTimer)
      if (container) {
        container.removeEventListener('scroll', onScroll)
        container.removeEventListener('pointermove', onPointerMove)
      }
      clearCardTransforms()
    }
  }, [])

  return null
}
