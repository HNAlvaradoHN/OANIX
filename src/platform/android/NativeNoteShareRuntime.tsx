import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes } from '../../features/notes/noteService'
import { noteBlocksToFullPlainText } from '../../features/notes/noteTypes'
import { sharePlainText } from './outboundShare'

interface ListShareTarget {
  element: HTMLElement
  noteId: string
}

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
  const [noteViewTarget, setNoteViewTarget] = useState<HTMLElement | null>(null)
  const [listTarget, setListTarget] = useState<ListShareTarget | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const refresh = () => {
      const nextNoteViewTarget = document.querySelector<HTMLElement>('.note-view__menu')
      setNoteViewTarget((current) => current === nextNoteViewTarget ? current : nextNoteViewTarget)

      const listMenu = document.querySelector<HTMLElement>('.note-row__menu')
      const listRow = listMenu?.closest<HTMLElement>('[data-reorder-note-id]') ?? null
      const noteId = listRow?.dataset.reorderNoteId?.trim() ?? ''
      const nextListTarget = listMenu && noteId
        ? { element: listMenu, noteId }
        : null

      setListTarget((current) => {
        if (!nextListTarget) return current === null ? current : null
        if (current?.element === nextListTarget.element && current.noteId === nextListTarget.noteId) {
          return current
        }
        return nextListTarget
      })
    }

    refresh()
    const appRoot = document.getElementById('root')
    if (!appRoot) return
    const observer = new MutationObserver(refresh)
    observer.observe(appRoot, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  async function handleShare(explicitNoteId?: string) {
    if (busy) return
    setBusy(true)

    try {
      const saved = await waitForVisibleSave()
      if (!saved) {
        window.alert('OANIX no pudo confirmar el guardado de la nota. Revisa el estado de guardado antes de compartirla.')
        return
      }

      const noteId = explicitNoteId?.trim() || currentNoteId()
      if (!noteId) {
        window.alert('No se pudo identificar la nota para compartir.')
        return
      }

      const notes = await loadNotes()
      const note = notes.find((item) => item.id === noteId)
      if (!note) {
        window.alert('No se pudo cargar la nota cifrada para compartirla.')
        return
      }

      const plainContent = noteBlocksToFullPlainText(note.content.blocks)
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

  const buttonLabel = busy ? 'Preparando…' : 'Compartir nota'

  return (
    <>
      {noteViewTarget && createPortal(
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => void handleShare()}
        >
          <span aria-hidden="true">↗</span> {buttonLabel}
        </button>,
        noteViewTarget,
      )}
      {listTarget && createPortal(
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => void handleShare(listTarget.noteId)}
        >
          <span aria-hidden="true">↗</span> {buttonLabel}
        </button>,
        listTarget.element,
      )}
    </>
  )
}
