import { useEffect, useRef, useState } from 'react'
import { OanixIcon } from '../../shared/OanixIcon'
import './noteEditor.css'
import './sheets/ruledSheet.css'

const AUTOSAVE_IDLE_MS = 3_000
const AUTOSAVE_FEEDBACK_DELAY_MS = 600

export interface NoteEditorSnapshot {
  title: string
  text: string
}

interface NoteEditorProps {
  noteId: string
  initialTitle: string
  initialText: string
  saving: boolean
  error?: string
  onRequestSave: (snapshot: NoteEditorSnapshot) => Promise<boolean>
  onRequestClose: (snapshot: NoteEditorSnapshot | null) => Promise<boolean>
  onActivity?: () => void
}

function snapshotsMatch(left: NoteEditorSnapshot, right: NoteEditorSnapshot): boolean {
  return left.title === right.title && left.text === right.text
}

/**
 * Editing stays local to this component. The large note body is intentionally uncontrolled:
 * ordinary keystrokes never copy the complete text into React state or re-render the Home shell.
 * Full snapshots are read only at idle/close save boundaries.
 */
export function NoteEditor({
  noteId,
  initialTitle,
  initialText,
  saving,
  error = '',
  onRequestSave,
  onRequestClose,
  onActivity,
}: NoteEditorProps) {
  const titleRef = useRef<HTMLInputElement | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const dirtyRef = useRef(false)
  const generationRef = useRef(0)
  const lastActivityAtRef = useRef(0)
  const composingRef = useRef(false)
  const closingRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef<Promise<boolean> | null>(null)
  const autosaveFeedbackTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const committedSnapshotRef = useRef<NoteEditorSnapshot>({
    title: initialTitle,
    text: initialText,
  })
  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const [autosaveVisible, setAutosaveVisible] = useState(false)

  function readSnapshot(): NoteEditorSnapshot {
    return {
      title: titleRef.current?.value ?? initialTitle,
      text: textRef.current?.value ?? initialText,
    }
  }

  function clearIdleTimer() {
    if (idleTimerRef.current === null) return
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }

  function stopAutosaveFeedback() {
    if (autosaveFeedbackTimerRef.current !== null) {
      window.clearTimeout(autosaveFeedbackTimerRef.current)
      autosaveFeedbackTimerRef.current = null
    }
    if (mountedRef.current) setAutosaveVisible(false)
  }

  function startAutosaveFeedback() {
    stopAutosaveFeedback()
    autosaveFeedbackTimerRef.current = window.setTimeout(() => {
      autosaveFeedbackTimerRef.current = null
      if (mountedRef.current) setAutosaveVisible(true)
    }, AUTOSAVE_FEEDBACK_DELAY_MS)
  }

  function markClean() {
    dirtyRef.current = false
    if (mountedRef.current) setDirty(false)
  }

  function armAutosaveTimer() {
    if (
      !dirtyRef.current
      || closingRef.current
      || composingRef.current
      || idleTimerRef.current !== null
    ) {
      return
    }

    const elapsed = Math.max(0, Date.now() - lastActivityAtRef.current)
    const delay = Math.max(0, AUTOSAVE_IDLE_MS - elapsed)
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      void runAutosaveIfIdle()
    }, delay)
  }

  async function saveCurrentSnapshot(): Promise<boolean> {
    if (!dirtyRef.current) return true

    if (saveInFlightRef.current) {
      return saveInFlightRef.current
    }

    const generation = generationRef.current
    const snapshot = readSnapshot()
    startAutosaveFeedback()

    const operation = (async () => {
      try {
        return await onRequestSave(snapshot)
      } catch {
        return false
      }
    })()
    saveInFlightRef.current = operation

    let succeeded = false
    try {
      succeeded = await operation
      if (succeeded) {
        committedSnapshotRef.current = snapshot
      }
      if (succeeded && generationRef.current === generation) {
        markClean()
      }
      return succeeded
    } finally {
      if (saveInFlightRef.current === operation) {
        saveInFlightRef.current = null
      }
      stopAutosaveFeedback()

      if (
        succeeded
        && dirtyRef.current
        && generationRef.current !== generation
        && !closingRef.current
      ) {
        armAutosaveTimer()
      }
    }
  }

  async function runAutosaveIfIdle() {
    if (!dirtyRef.current || closingRef.current) return
    if (composingRef.current) return

    if (saveInFlightRef.current) {
      await saveInFlightRef.current
      if (dirtyRef.current && !closingRef.current) armAutosaveTimer()
      return
    }

    const elapsed = Math.max(0, Date.now() - lastActivityAtRef.current)
    if (elapsed < AUTOSAVE_IDLE_MS) {
      armAutosaveTimer()
      return
    }

    await saveCurrentSnapshot()
  }

  function markActivity() {
    onActivity?.()
    generationRef.current += 1
    lastActivityAtRef.current = Date.now()

    if (!dirtyRef.current) {
      dirtyRef.current = true
      setDirty(true)
    }

    armAutosaveTimer()
  }

  function handleCompositionStart() {
    composingRef.current = true
    lastActivityAtRef.current = Date.now()
    onActivity?.()
  }

  function handleCompositionEnd() {
    composingRef.current = false
    lastActivityAtRef.current = Date.now()
    onActivity?.()
    if (dirtyRef.current) armAutosaveTimer()
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false
      clearIdleTimer()
      if (autosaveFeedbackTimerRef.current !== null) {
        window.clearTimeout(autosaveFeedbackTimerRef.current)
        autosaveFeedbackTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!dirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  async function requestClose() {
    if (saving || closingRef.current) return

    closingRef.current = true
    setClosing(true)
    clearIdleTimer()

    let closed = false
    try {
      if (saveInFlightRef.current) {
        await saveInFlightRef.current
      }

      const snapshot = readSnapshot()
      if (snapshotsMatch(snapshot, committedSnapshotRef.current)) {
        markClean()
        closed = await onRequestClose(null)
        return
      }

      closed = await onRequestClose(snapshot)
      if (closed) {
        committedSnapshotRef.current = snapshot
        markClean()
      }
    } finally {
      if (!closed && mountedRef.current) {
        closingRef.current = false
        setClosing(false)
        if (dirtyRef.current) armAutosaveTimer()
      }
    }
  }

  const editingDisabled = saving || closing

  return (
    <section
      className="oanix-note-editor"
      aria-label="Editor de nota"
      aria-busy={saving || closing}
      data-oanix-note-id={noteId}
      data-oanix-unsaved={dirty ? 'true' : 'false'}
    >
      <header className="oanix-note-editor__header">
        <button
          type="button"
          className="rebuild-icon-button oanix-note-editor__back"
          data-oanix-back-close="true"
          data-oanix-save-and-close="true"
          onClick={() => void requestClose()}
          aria-label="Guardar y volver"
          disabled={editingDisabled}
        >
          <OanixIcon name="back" />
        </button>

        <input
          ref={titleRef}
          className="oanix-note-editor__title"
          defaultValue={initialTitle}
          onInput={markActivity}
          maxLength={160}
          aria-label="Título de la nota"
          autoComplete="off"
          readOnly={editingDisabled}
        />

        {autosaveVisible && (
          <span className="oanix-note-editor__autosave-status" role="status" aria-live="polite">
            Guardando…
          </span>
        )}
      </header>

      {error && <div className="oanix-note-editor__error" role="alert">{error}</div>}

      <div className="oanix-note-editor__sheet" data-oanix-sheet="ruled-v1">
        <textarea
          ref={textRef}
          className="oanix-note-editor__body"
          defaultValue={initialText}
          onInput={markActivity}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder="Empieza a escribir…"
          aria-label="Contenido de la nota"
          autoFocus
          spellCheck
          wrap="soft"
          readOnly={editingDisabled}
        />
      </div>
    </section>
  )
}
