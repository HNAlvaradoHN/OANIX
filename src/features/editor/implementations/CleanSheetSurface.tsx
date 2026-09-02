import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  EditorSurfaceProps,
  EditorSurfaceSnapshot,
} from '../editorSurfaceContract'
import './cleanSheetSurface.css'

const AUTOSAVE_DELAY_MS = 3000

function makeSnapshot(title: string, text: string): EditorSurfaceSnapshot {
  return { title, text }
}

function resizeBodyToContent(element: HTMLTextAreaElement | null): void {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

export function CleanSheetSurface({
  noteId,
  initialTitle,
  initialText,
  saving,
  error,
  onRequestSave,
  onRequestClose,
  onActivity,
}: EditorSurfaceProps) {
  const [title, setTitle] = useState(initialTitle)
  const [text, setText] = useState(initialText)
  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef(false)
  const queuedSaveRef = useRef(false)
  const latestRef = useRef(makeSnapshot(initialTitle, initialText))

  useEffect(() => {
    setTitle(initialTitle)
    setText(initialText)
    setDirty(false)
    setClosing(false)
    latestRef.current = makeSnapshot(initialTitle, initialText)
  }, [noteId, initialTitle, initialText])

  useEffect(() => {
    resizeBodyToContent(bodyRef.current)
  }, [text, noteId])

  useEffect(() => {
    const handleResize = () => resizeBodyToContent(bodyRef.current)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [])

  const saveNow = useCallback(async () => {
    clearSaveTimer()

    if (saveInFlightRef.current) {
      queuedSaveRef.current = true
      return false
    }

    saveInFlightRef.current = true
    const snapshot = latestRef.current

    try {
      const saved = await onRequestSave(snapshot)
      if (saved && latestRef.current.title === snapshot.title && latestRef.current.text === snapshot.text) {
        setDirty(false)
      }
      return saved
    } finally {
      saveInFlightRef.current = false
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false
        void saveNow()
      }
    }
  }, [clearSaveTimer, onRequestSave])

  const scheduleSave = useCallback(() => {
    clearSaveTimer()
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void saveNow()
    }, AUTOSAVE_DELAY_MS)
  }, [clearSaveTimer, saveNow])

  const markChanged = useCallback(
    (nextTitle: string, nextText: string) => {
      latestRef.current = makeSnapshot(nextTitle, nextText)
      setDirty(true)
      onActivity?.()
      scheduleSave()
    },
    [onActivity, scheduleSave],
  )

  useEffect(() => {
    return () => clearSaveTimer()
  }, [clearSaveTimer])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveNow()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveNow])

  const handleClose = useCallback(async () => {
    if (closing) return

    setClosing(true)
    clearSaveTimer()

    const snapshot = latestRef.current
    const closed = await onRequestClose(snapshot)

    if (!closed) {
      setClosing(false)
    }
  }, [clearSaveTimer, closing, onRequestClose])

  return (
    <section className="clean-sheet" aria-label="Editor de nota">
      <header className="clean-sheet__topbar">
        <button
          type="button"
          className="clean-sheet__back"
          onClick={() => void handleClose()}
          disabled={closing}
          aria-label="Volver"
        >
          ←
        </button>

        <div className="clean-sheet__status" aria-live="polite">
          {error ? (
            <span className="clean-sheet__status-error">No se pudo guardar</span>
          ) : saving || saveInFlightRef.current ? (
            <span>Guardando…</span>
          ) : dirty ? (
            <span>Sin guardar</span>
          ) : (
            <span>Guardado</span>
          )}
        </div>

        <button
          type="button"
          className="clean-sheet__save"
          onClick={() => void saveNow()}
          disabled={saving || closing || !dirty}
        >
          Guardar
        </button>
      </header>

      <main className="clean-sheet__viewport">
        <article className="clean-sheet__paper">
          <input
            className="clean-sheet__title"
            value={title}
            onChange={(event) => {
              const nextTitle = event.target.value
              setTitle(nextTitle)
              markChanged(nextTitle, text)
            }}
            placeholder="Título"
            aria-label="Título de la nota"
            autoComplete="off"
            spellCheck
          />

          <textarea
            ref={bodyRef}
            className="clean-sheet__body"
            value={text}
            onChange={(event) => {
              resizeBodyToContent(event.currentTarget)
              const nextText = event.target.value
              setText(nextText)
              markChanged(title, nextText)
            }}
            placeholder="Empieza a escribir…"
            aria-label="Contenido de la nota"
            spellCheck
          />
        </article>
      </main>
    </section>
  )
}
