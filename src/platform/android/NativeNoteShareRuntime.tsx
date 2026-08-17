import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes } from '../../features/notes/noteService'
import { noteBlocksToPlainText } from '../../features/notes/noteTypes'
import { sharePlainText } from './outboundShare'

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

function currentNoteId(): string | null {
  const historyState = window.history.state
  if (historyState && typeof historyState === 'object' && typeof historyState.noteId === 'string') {
    return historyState.noteId
  }

  return document.querySelector<HTMLElement>('.note-row--selected')?.dataset.reorderNoteId ?? null
}

async function waitForVisibleSave(): Promise<boolean> {
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.blur()

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const status = document.querySelector<HTMLElement>('.save-status')?.textContent?.trim() ?? ''
    if (!status || (!/cambios pendientes|guardando/i.test(status) && !/no se pudo guardar/i.test(status))) {
      return true
    }
    if (/no se pudo guardar/i.test(status)) return false
    await wait(100)
  }
  return false
}

export function NativeNoteShareRuntime() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setTarget(document.querySelector<HTMLElement>('.note-view__menu'))
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!target) return null

  async function handleShare() {
    if (busy) return
    setBusy(true)

    try {
      const saved = await waitForVisibleSave()
      if (!saved) {
        window.alert('OANIX no pudo confirmar el guardado de la nota. Revisa el estado de guardado antes de compartirla.')
        return
      }

      const noteId = currentNoteId()
      if (!noteId) {
        window.alert('No se pudo identificar la nota abierta.')
        return
      }

      const notes = await loadNotes()
      const note = notes.find((item) => item.id === noteId)
      if (!note) {
        window.alert('No se pudo cargar la nota cifrada para compartirla.')
        return
      }

      const plainContent = noteBlocksToPlainText(note.content.blocks)
      const title = note.title.trim() || 'Nota de OANIX'
      const text = plainContent ? `${title}\n\n${plainContent}` : title
      await sharePlainText(title, text)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      window.alert(error instanceof Error ? error.message : 'No se pudo compartir la nota.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <button
      type="button"
      role="menuitem"
      disabled={busy}
      onClick={() => void handleShare()}
    >
      <span aria-hidden="true">↗</span> {busy ? 'Preparando…' : 'Compartir nota'}
    </button>,
    target,
  )
}
