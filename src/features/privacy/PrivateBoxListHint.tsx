import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function PrivateBoxListHint() {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    if (!workspace) return

    let frame = 0

    function inspect() {
      const list = workspace.querySelector<HTMLElement>('.notes-list')
      setHost(list)

      if (!list || workspace.querySelector('.notes-search')) {
        setShow(false)
        return
      }

      const rows = Array.from(list.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]'))
      if (rows.length === 0) {
        setShow(false)
        return
      }

      const privateRows = rows.filter((row) => row.dataset.oanixPrivateNote === 'true')
      const visibleRows = rows.filter((row) => row.dataset.oanixPrivacyHidden !== 'true')
      setShow(privateRows.length > 0 && visibleRows.length === 0)
    }

    function scheduleInspect() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        inspect()
      })
    }

    inspect()
    const observer = new MutationObserver(scheduleInspect)
    observer.observe(workspace, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-oanix-private-note', 'data-oanix-privacy-hidden'],
    })

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  if (!host || !show) return null

  return createPortal(
    <div className="notes-empty oanix-private-list-hint" role="status">
      <div className="notes-empty__icon" aria-hidden="true">🗄️</div>
      <strong>No hay notas visibles aquí</strong>
      <p>Las notas de Caja privada permanecen apartadas de la lista normal.</p>
    </div>,
    host,
  )
}
