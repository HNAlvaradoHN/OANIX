import { useEffect } from 'react'
import { loadNotes } from './noteService'
import {
  DEFAULT_NOTE_VISUAL_COLOR,
  DEFAULT_NOTE_VISUAL_ICON,
  NOTE_VISUAL_COLORS,
  type NoteRecord,
} from './noteTypes'

const RELOAD_DELAY_MS = 40

interface NoteVisualChangedDetail {
  note?: NoteRecord
}

function fallbackColorForNote(noteId: string): string {
  let hash = 2166136261
  for (let index = 0; index < noteId.length; index += 1) {
    hash ^= noteId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const palette = NOTE_VISUAL_COLORS.length > 0 ? NOTE_VISUAL_COLORS : [DEFAULT_NOTE_VISUAL_COLOR]
  return palette[Math.abs(hash) % palette.length] ?? DEFAULT_NOTE_VISUAL_COLOR
}

function visualColor(note: NoteRecord): string {
  return note.visualColor ?? fallbackColorForNote(note.id)
}

export function NoteVisualIdentityRuntime() {
  useEffect(() => {
    let disposed = false
    let applyFrame: number | null = null
    let reloadTimer: number | null = null
    let notesById = new Map<string, NoteRecord>()

    const applyIdentity = () => {
      applyFrame = null
      document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]').forEach((row) => {
        const noteId = row.dataset.reorderNoteId
        const note = noteId ? notesById.get(noteId) : null
        if (!note) return

        const color = visualColor(note)
        if (row.style.getPropertyValue('--oanix-note-card-color').trim() !== color) {
          row.style.setProperty('--oanix-note-card-color', color)
        }
        if (row.style.getPropertyValue('--oanix-note-tab-color').trim() !== color) {
          row.style.setProperty('--oanix-note-tab-color', color)
        }

        const avatar = row.querySelector<HTMLElement>('.note-row__avatar')
        const icon = note.visualIcon ?? DEFAULT_NOTE_VISUAL_ICON
        if (avatar && avatar.dataset.oanixNoteIcon !== icon) avatar.dataset.oanixNoteIcon = icon
      })
    }

    const scheduleApply = () => {
      if (applyFrame !== null) return
      applyFrame = window.requestAnimationFrame(applyIdentity)
    }

    const reload = async () => {
      try {
        const notes = await loadNotes()
        if (disposed) return
        notesById = new Map(notes.map((note) => [note.id, note]))
        scheduleApply()
      } catch {
        // A later local/sync event will retry. Visual decoration must never block notes.
      }
    }

    const scheduleReload = () => {
      if (reloadTimer !== null) window.clearTimeout(reloadTimer)
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null
        void reload()
      }, RELOAD_DELAY_MS)
    }

    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    const observer = new MutationObserver(scheduleApply)
    if (workspace) {
      observer.observe(workspace, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'data-oanix-note-icon'],
      })
    }

    const handleLocalChange = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { recordType?: unknown } | null
        : null
      if (!detail?.recordType || detail.recordType === 'note') scheduleReload()
    }

    const handleVisualChanged = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as NoteVisualChangedDetail | null
        : null
      const note = detail?.note
      if (!note?.id) return
      notesById.set(note.id, note)
      scheduleApply()
    }

    const handleOrderPersisted = () => scheduleApply()
    const handleConflictResolved = () => scheduleReload()

    window.addEventListener('oanix:local-data-changed', handleLocalChange)
    window.addEventListener('oanix:note-visual-changed', handleVisualChanged)
    window.addEventListener('oanix:note-order-persisted', handleOrderPersisted)
    window.addEventListener('oanix:conflict-resolved', handleConflictResolved)

    void reload()

    return () => {
      disposed = true
      observer.disconnect()
      window.removeEventListener('oanix:local-data-changed', handleLocalChange)
      window.removeEventListener('oanix:note-visual-changed', handleVisualChanged)
      window.removeEventListener('oanix:note-order-persisted', handleOrderPersisted)
      window.removeEventListener('oanix:conflict-resolved', handleConflictResolved)
      if (applyFrame !== null) window.cancelAnimationFrame(applyFrame)
      if (reloadTimer !== null) window.clearTimeout(reloadTimer)
    }
  }, [])

  return null
}
