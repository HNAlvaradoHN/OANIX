const ATOMIC_DELETE_SELECTOR = '.oanix-text-atomic__delete-block'

function blockLabel(kind: string | undefined): string {
  if (kind === 'quote') return 'Cita'
  if (kind === 'list') return 'Lista'
  if (kind === 'numbered-list') return 'Lista numérica'
  return 'este elemento'
}

/**
 * Confirmation guard for managed text elements.
 *
 * The editor still owns the actual deletion and persistence. This capture-phase
 * listener only blocks the existing delete action when the user cancels, so it
 * cannot delete or mutate note data by itself.
 */
export function installOanixAtomicDeleteConfirmation(): () => void {
  const handleClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>(ATOMIC_DELETE_SELECTOR)
    if (!button || button.disabled) return

    const block = button.closest<HTMLElement>('.oanix-text-atomic')
    const label = blockLabel(block?.dataset.oanixElementKind)
    const confirmed = window.confirm(
      `¿Eliminar ${label}?\n\nSe eliminará el bloque completo de la nota.`,
    )
    if (confirmed) return

    event.preventDefault()
    event.stopImmediatePropagation()
  }

  document.addEventListener('click', handleClick, true)
  return () => document.removeEventListener('click', handleClick, true)
}
