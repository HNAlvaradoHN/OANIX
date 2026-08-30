import { useCallback, useEffect, useRef, useState } from 'react'
import { loadNote, setNoteSheetAppearance } from './noteService'
import {
  DEFAULT_NOTE_SHEET_APPEARANCE,
  type NoteRecord,
  type NoteSheetAppearance,
} from './noteTypes'

function cloneAppearance(value?: NoteSheetAppearance): NoteSheetAppearance {
  return { ...(value ?? DEFAULT_NOTE_SHEET_APPEARANCE) }
}

export function useNoteSheetAppearanceAdapter(note: Pick<NoteRecord, 'id' | 'sheetAppearance'>) {
  const noteIdRef = useRef(note.id)
  const appearanceRef = useRef<NoteSheetAppearance>(cloneAppearance(note.sheetAppearance))
  const [appearance, setAppearance] = useState<NoteSheetAppearance>(appearanceRef.current)

  useEffect(() => {
    noteIdRef.current = note.id
    const initial = cloneAppearance(note.sheetAppearance)
    appearanceRef.current = initial
    setAppearance(initial)

    let cancelled = false
    void loadNote(note.id).then((stored) => {
      if (cancelled || noteIdRef.current !== note.id || !stored) return
      const hydrated = cloneAppearance(stored.sheetAppearance)
      appearanceRef.current = hydrated
      setAppearance(hydrated)
    }).catch(() => {
      // The visual shell keeps the in-memory/default appearance if hydration fails.
    })

    return () => {
      cancelled = true
    }
  }, [note.id, note.sheetAppearance])

  const updateAppearance = useCallback(async (patch: Partial<NoteSheetAppearance>): Promise<boolean> => {
    const noteId = noteIdRef.current
    const previous = appearanceRef.current
    const next = { ...previous, ...patch }

    appearanceRef.current = next
    setAppearance(next)

    try {
      const updated = await setNoteSheetAppearance(noteId, next)
      if (noteIdRef.current === noteId) {
        const persisted = cloneAppearance(updated.sheetAppearance)
        appearanceRef.current = persisted
        setAppearance(persisted)
      }
      return true
    } catch {
      if (noteIdRef.current === noteId && appearanceRef.current === next) {
        appearanceRef.current = previous
        setAppearance(previous)
      }
      return false
    }
  }, [])

  return { appearance, updateAppearance }
}
