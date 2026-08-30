import { useEffect } from 'react'

const CODE_CONVERSION_CONFIRMATION =
  '¿Convertir este bloque de código a texto? El bloque de código se eliminará y el contenido se conservará como texto.'

function selectionCodeBlockWithin(root: HTMLElement): HTMLElement | null {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const anchor = selection.anchorNode
  const element = anchor instanceof Element ? anchor : anchor?.parentElement ?? null
  const block = element?.closest<HTMLElement>('[data-code-block="true"]') ?? null
  return block && root.contains(block) ? block : null
}

function denyDestructiveAction(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

/**
 * Aurora-only guard for actions whose visible intent is transformation rather
 * than deletion, but whose persisted result still removes an inserted atomic
 * element. Keeping this outside the theme markup preserves the prototype while
 * enforcing OANIX's explicit-confirmation contract before shared editor logic
 * is allowed to persist the change.
 */
export function AuroraDestructiveActionConfirmationRuntime() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const root = target.closest<HTMLElement>('[data-note-sheet-theme="aurora"]')
      if (!root) return

      const convert = target.closest<HTMLElement>('[data-code-convert="true"]')
      if (convert && root.contains(convert)) {
        if (!window.confirm(CODE_CONVERSION_CONFIRMATION)) denyDestructiveAction(event)
        return
      }

      const formatCode = target.closest<HTMLElement>('[data-format="code"]')
      if (!formatCode || !root.contains(formatCode) || formatCode.getAttribute('aria-pressed') !== 'true') {
        return
      }

      if (!selectionCodeBlockWithin(root)) return
      if (!window.confirm(CODE_CONVERSION_CONFIRMATION)) denyDestructiveAction(event)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}
