import { useEffect, useRef, useState } from 'react'
import {
  createEditorBlockSession,
  type EditorBlockSession,
} from '../editorBlockSession'
import type {
  EditorSurfaceProps,
  EditorSurfaceSnapshot,
} from '../editorSurfaceContract'
import { QwenChecklistBlocks } from './QwenChecklistBlocks'
import { QwenCodeBlocks } from './QwenCodeBlocks'
import './qwenSheetSurface.css'

const AUTOSAVE_IDLE_MS = 3_000
const AUTOSAVE_FEEDBACK_DELAY_MS = 600

type InsertBlockKind = 'checklist' | 'code'

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

export function QwenSheetSurface({
  noteId,
  initialTitle,
  initialText,
  saving,
  error = '',
  onRequestSave,
  onRequestClose,
  loadBlocks,
  onRequestBlockSave,
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
  const blockSessionRef = useRef<EditorBlockSession | null>(null)
  if (blockSessionRef.current === null && loadBlocks && onRequestBlockSave) {
    blockSessionRef.current = createEditorBlockSession({ loadBlocks, saveChanges: onRequestBlockSave })
  }
  const committedSnapshotRef = useRef<EditorSurfaceSnapshot>({ title: initialTitle, text: initialText })
  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const [autosaveVisible, setAutosaveVisible] = useState(false)
  const [insertMenuOpen, setInsertMenuOpen] = useState(false)
  const [checklistInsertRequest, setChecklistInsertRequest] = useState(0)
  const [codeInsertRequest, setCodeInsertRequest] = useState(0)

  function readSnapshot(): EditorSurfaceSnapshot {
    return { title: titleRef.current?.value ?? initialTitle, text: bodyRef.current?.value ?? initialText }
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
    if (!dirtyRef.current || closingRef.current || composingRef.current || idleTimerRef.current !== null) return
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
    const snapshotChanged = !snapshotsMatch(snapshot, committedSnapshotRef.current)
    const blockSession = blockSessionRef.current
    startAutosaveFeedback()

    let textSaved = !snapshotChanged
    const operation = (async () => {
      try {
        if (snapshotChanged) {
          textSaved = await onRequestSave(snapshot)
          if (!textSaved) return false
        }
        if (blockSession?.hasPending() && !(await blockSession.flush())) return false
        return true
      } catch {
        return false
      }
    })()
    saveInFlightRef.current = operation

    let succeeded = false
    try {
      succeeded = await operation
      if (textSaved && snapshotChanged) committedSnapshotRef.current = snapshot
      if (succeeded && generationRef.current === generation && !blockSession?.hasPending()) markClean()
      return succeeded
    } finally {
      if (saveInFlightRef.current === operation) saveInFlightRef.current = null
      stopAutosaveFeedback()
      if (succeeded && dirtyRef.current && generationRef.current !== generation && !closingRef.current) armAutosaveTimer()
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

  function insertBlock(kind: InsertBlockKind) {
    setInsertMenuOpen(false)
    if (kind === 'checklist') setChecklistInsertRequest((value) => value + 1)
    else setCodeInsertRequest((value) => value + 1)
  }

  async function requestClose() {
    if (saving || closingRef.current) return
    closingRef.current = true
    setClosing(true)
    clearIdleTimer()

    let closed = false
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      const blockSession = blockSessionRef.current
      if (blockSession && !(await blockSession.flush())) return
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

  useEffect(() => () => {
    mountedRef.current = false
    clearIdleTimer()
    if (autosaveFeedbackTimerRef.current !== null) window.clearTimeout(autosaveFeedbackTimerRef.current)
  }, [])

  useEffect(() => {
    if (!dirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const editingDisabled = saving || closing
  const blockSession = blockSessionRef.current

  return (
    <section className="oanix-qwen-sheet" aria-label="Editor de nota" aria-busy={saving || closing} data-oanix-note-id={noteId} data-oanix-unsaved={dirty ? 'true' : 'false'} data-oanix-sheet="qwen-sanitized-v1">
      <div className="oanix-qwen-sheet__grain" aria-hidden="true" />
      <header className="oanix-qwen-sheet__topbar">
        <button type="button" className="oanix-qwen-sheet__icon-button" data-oanix-back-close="true" data-oanix-save-and-close="true" aria-label="Guardar y volver" disabled={editingDisabled} onClick={() => void requestClose()}><BackIcon /></button>
        <div className="oanix-qwen-sheet__brand" aria-label="OANIX"><b>✦</b><span>OANIX</span></div>
        <div className="oanix-qwen-sheet__status" role="status" aria-live="polite">{autosaveVisible || saving ? 'Guardando…' : dirty ? 'Pendiente' : 'Guardado'}</div>
      </header>

      {error && <div className="oanix-qwen-sheet__error" role="alert">{error}</div>}

      <main className="oanix-qwen-sheet__page">
        <div className="oanix-qwen-sheet__canvas">
          <div className="oanix-qwen-sheet__meta" aria-hidden="true"><span className="oanix-qwen-sheet__meta-chip">Nota</span><span className="oanix-qwen-sheet__meta-dot">•</span><span className="oanix-qwen-sheet__save-dot" /></div>
          <input ref={titleRef} className="oanix-qwen-sheet__title" defaultValue={initialTitle} maxLength={160} autoComplete="off" aria-label="Título de la nota" readOnly={editingDisabled} onInput={markActivity} />
          <div className="oanix-qwen-sheet__divider" aria-hidden="true" />
          <textarea ref={bodyRef} className="oanix-qwen-sheet__body" defaultValue={initialText} placeholder="Empieza a escribir…" aria-label="Contenido de la nota" autoFocus spellCheck wrap="soft" readOnly={editingDisabled} onInput={markActivity} onCompositionStart={handleCompositionStart} onCompositionEnd={handleCompositionEnd} />

          {blockSession && (
            <div className="oanix-qwen-sheet__rich-content">
              <div className="oanix-qwen-sheet__insert">
                <button type="button" className="oanix-qwen-sheet__insert-trigger" aria-expanded={insertMenuOpen} aria-controls="oanix-qwen-insert-menu" disabled={editingDisabled} onClick={() => setInsertMenuOpen((open) => !open)}>+ Insertar</button>
                {insertMenuOpen && (
                  <div id="oanix-qwen-insert-menu" className="oanix-qwen-sheet__insert-menu" role="menu" aria-label="Insertar bloque">
                    <button type="button" role="menuitem" onClick={() => insertBlock('checklist')}><strong>Checklist</strong><span>Lista de tareas verificable</span></button>
                    <button type="button" role="menuitem" onClick={() => insertBlock('code')}><strong>Código</strong><span>Fragmento técnico con lenguaje opcional</span></button>
                  </div>
                )}
              </div>
              <QwenChecklistBlocks session={blockSession} disabled={editingDisabled} insertRequest={checklistInsertRequest} onActivity={markActivity} />
              <QwenCodeBlocks session={blockSession} disabled={editingDisabled} insertRequest={codeInsertRequest} onActivity={markActivity} />
            </div>
          )}
        </div>
      </main>
    </section>
  )
}
