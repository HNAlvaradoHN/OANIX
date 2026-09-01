import { useEffect, useRef, useState } from 'react'
import type {
  EditorSurfaceProps,
  EditorSurfaceSnapshot,
} from '../editorSurfaceContract'
import './qwenSheetSurface.css'

const AUTOSAVE_IDLE_MS = 3_000
const AUTOSAVE_FEEDBACK_DELAY_MS = 600

function snapshotsMatch(left: EditorSurfaceSnapshot, right: EditorSurfaceSnapshot): boolean {
  return left.title === right.title && left.text === right.text
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

/**
 * Sanitized OANIX port of the selected qwen.html/appquen.js sheet.
 *
 * The original prototype supplied the visual language only. Runtime persistence,
 * demo state, remote assets/CDNs and the duplicate inline JavaScript authority are
 * intentionally not carried into OANIX. This component receives note data and
 * lifecycle actions exclusively through EditorSurfaceProps.
 *
 * The first production cut keeps the proven OANIX plain-text data contract while
 * establishing the selected sheet's paper/canvas visual surface. Rich blocks and
 * attachments remain disabled until their payload contracts can be added without
 * creating parallel storage or migrations.
 */
export function QwenSheetSurface({
  noteId,
  initialTitle,
  initialText,
  saving,
  error = '',
  onRequestSave,
  onRequestClose,
  onActivity,
}: EditorSurfaceProps) {
  const titleRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const dirtyRef = useRef(false)
  const generationRef = useRef(0)
  const lastActivityAtRef = useRef(0)
  const composingRef = useRef(false)
  const closingRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef<Promise<boolean> | null>(null)
  const autosaveFeedbackTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const committedSnapshotRef = useRef<EditorSurfaceSnapshot>({
    title: initialTitle,
    text: initialText,
  })
  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const [autosaveVisible, setAutosaveVisible] = useState(false)

  function readSnapshot(): EditorSurfaceSnapshot {
    return {
      title: titleRef.current?.value ?? initialTitle,
      text: bodyRef.current?.value ?? initialText,
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
    if (saveInFlightRef.current) return saveInFlightRef.current

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
      if (succeeded) committedSnapshotRef.current = snapshot
      if (succeeded && generationRef.current === generation) markClean()
      return succeeded
    } finally {
      if (saveInFlightRef.current === operation) saveInFlightRef.current = null
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
    if (!dirtyRef.current || closingRef.current || composingRef.current) return

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

  async function requestClose() {
    if (saving || closingRef.current) return

    closingRef.current = true
    setClosing(true)
    clearIdleTimer()

    let closed = false
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current

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
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const editingDisabled = saving || closing

  return (
    <section
      className="oanix-qwen-sheet"
      aria-label="Editor de nota"
      aria-busy={saving || closing}
      data-oanix-note-id={noteId}
      data-oanix-unsaved={dirty ? 'true' : 'false'}
      data-oanix-sheet="qwen-sanitized-v1"
    >
      <div className="oanix-qwen-sheet__grain" aria-hidden="true" />

      <header className="oanix-qwen-sheet__topbar">
        <button
          type="button"
          className="oanix-qwen-sheet__icon-button"
          data-oanix-back-close="true"
          data-oanix-save-and-close="true"
          aria-label="Guardar y volver"
          disabled={editingDisabled}
          onClick={() => void requestClose()}
        >
          <BackIcon />
        </button>

        <div className="oanix-qwen-sheet__brand" aria-label="OANIX">
          <b>✦</b>
          <span>OANIX</span>
        </div>

        <div className="oanix-qwen-sheet__status" role="status" aria-live="polite">
          {autosaveVisible || saving ? 'Guardando…' : dirty ? 'Pendiente' : 'Guardado'}
        </div>
      </header>

      {error && (
        <div className="oanix-qwen-sheet__error" role="alert">
          {error}
        </div>
      )}

      <main className="oanix-qwen-sheet__page">
        <div className="oanix-qwen-sheet__canvas">
          <div className="oanix-qwen-sheet__meta" aria-hidden="true">
            <span className="oanix-qwen-sheet__meta-chip">Nota</span>
            <span className="oanix-qwen-sheet__meta-dot">•</span>
            <span className="oanix-qwen-sheet__save-dot" />
          </div>

          <input
            ref={titleRef}
            className="oanix-qwen-sheet__title"
            defaultValue={initialTitle}
            maxLength={160}
            autoComplete="off"
            aria-label="Título de la nota"
            readOnly={editingDisabled}
            onInput={markActivity}
          />

          <div className="oanix-qwen-sheet__divider" aria-hidden="true" />

          <textarea
            ref={bodyRef}
            className="oanix-qwen-sheet__body"
            defaultValue={initialText}
            placeholder="Empieza a escribir…"
            aria-label="Contenido de la nota"
            autoFocus
            spellCheck
            wrap="soft"
            readOnly={editingDisabled}
            onInput={markActivity}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
          />
        </div>
      </main>
    </section>
  )
}
