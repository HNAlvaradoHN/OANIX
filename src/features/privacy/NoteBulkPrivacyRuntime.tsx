import { useEffect, useRef } from 'react'

export const NOTE_PRIVACY_REFRESH_EVENT = 'oanix:note-privacy-refresh'

function noteRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]'))
}

function dispatchPrivacyRefresh() {
  window.dispatchEvent(new Event(NOTE_PRIVACY_REFRESH_EVENT))
}

/**
 * Legacy-named privacy refresh bridge.
 *
 * Bulk note marking is no longer part of the active workspace. This runtime
 * only keeps the existing per-note privacy UI synchronized when React adds a
 * newly-created note row without remounting the whole workspace.
 */
export function NoteBulkPrivacyRuntime() {
  const knownRowIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    knownRowIdsRef.current = new Set(
      noteRows().flatMap((row) => row.dataset.reorderNoteId ? [row.dataset.reorderNoteId] : []),
    )

    let frame = 0
    const scanRows = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        let foundNewNote = false

        for (const row of noteRows()) {
          const noteId = row.dataset.reorderNoteId
          if (!noteId || knownRowIdsRef.current.has(noteId)) continue
          knownRowIdsRef.current.add(noteId)
          foundNewNote = true
        }

        if (foundNewNote) dispatchPrivacyRefresh()
      })
    }

    const noteList = document.querySelector<HTMLElement>('.notes-list')
    if (!noteList) return

    const observer = new MutationObserver(scanRows)
    observer.observe(noteList, { childList: true })

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return null
}
