import { useEffect, useRef, useState } from 'react'
import {
  createEditorBlockSession,
  type EditorBlockSession,
} from '../editorBlockSession'
import type {
  EditorSurfaceProps,
  EditorSurfaceSnapshot,
} from '../editorSurfaceContract'
import {
  QwenRichBlocks,
  type QwenExternalInsertRequest,
  type QwenInsertBlockKind,
} from './QwenRichBlocks'
import {
  ReplicaV16Attachments,
  type ReplicaAttachmentInsertKind,
  type ReplicaAttachmentInsertRequest,
} from './ReplicaV16Attachments'
import './replicaV16SheetSurface.css'

const AUTOSAVE_IDLE_MS = 3_000
const AUTOSAVE_FEEDBACK_DELAY_MS = 600

type SheetDesign = 'plain' | 'ruled' | 'dots' | 'grid'

function snapshotsMatch(left: EditorSurfaceSnapshot, right: EditorSurfaceSnapshot): boolean {
  return left.title === right.title && left.text === right.text
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

function SlidersIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6" /></svg>
}

export function ReplicaV16SheetSurface({
  noteId,
  initialTitle,
  initialText,
  saving,
  error = '',
  onRequestSave,
  onRequestClose,
  loadBlocks,
  onRequestBlockSave,
  loadAttachments,
  onRequestAttachmentStore,
  loadAttachmentFile,
  onRequestAttachmentRemove,
  onActivity,
}: EditorSurfaceProps) {
  const titleRef = useRef<HTMLTextAreaElement | null>(null)
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
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const blockSessionRef = useRef<EditorBlockSession | null>(null)

  if (blockSessionRef.current === null && loadBlocks && onRequestBlockSave) {
    blockSessionRef.current = createEditorBlockSession({ loadBlocks, saveChanges: onRequestBlockSave })
  }

  const committedSnapshotRef = useRef<EditorSurfaceSnapshot>({ title: initialTitle, text: initialText })
  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const [autosaveVisible, setAutosaveVisible] = useState(false)
  const [insertMenuOpen, setInsertMenuOpen] = useState(false)
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false)
  const [design, setDesign] = useState<SheetDesign>('plain')
  const [insertRequest, setInsertRequest] = useState<QwenExternalInsertRequest | null>(null)
  const [attachmentInsertRequest, setAttachmentInsertRequest] = useState<ReplicaAttachmentInsertRequest | null>(null)
  const insertTokenRef = useRef(0)
  const attachmentTokenRef = useRef(0)

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

  async function requestClose() {
    if (saving || closingRef.current) return
    closingRef.current = true
    setClosing(true)
    setInsertMenuOpen(false)
    setToolsMenuOpen(false)
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

  function requestInsert(kind: QwenInsertBlockKind) {
    insertTokenRef.current += 1
    setInsertRequest({ token: insertTokenRef.current, kind })
    setInsertMenuOpen(false)
  }

  function requestAttachmentInsert(kind: ReplicaAttachmentInsertKind) {
    attachmentTokenRef.current += 1
    setAttachmentInsertRequest({ token: attachmentTokenRef.current, kind })
    setInsertMenuOpen(false)
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

  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      const target = event.target as Node | null
      if (target && controlsRef.current?.contains(target)) return
      setInsertMenuOpen(false)
      setToolsMenuOpen(false)
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setInsertMenuOpen(false)
      setToolsMenuOpen(false)
    }
    window.addEventListener('pointerdown', closeMenus)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('pointerdown', closeMenus)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  const editingDisabled = saving || closing
  const blockSession = blockSessionRef.current
  const attachmentsEnabled = Boolean(loadAttachments && onRequestAttachmentStore && loadAttachmentFile && onRequestAttachmentRemove)
  const sheetClass = `oanix-replica-v16 oanix-replica-v16--${design}`

  return (
    <section
      className={sheetClass}
      aria-label="Editor experimental V16"
      aria-busy={saving || closing}
      data-oanix-note-id={noteId}
      data-oanix-unsaved={dirty ? 'true' : 'false'}
      data-oanix-sheet="replica-v16"
    >
      <div className="oanix-replica-v16__grain" aria-hidden="true" />

      <header className="oanix-replica-v16__topbar">
        <button type="button" className="oanix-replica-v16__icon" data-oanix-back-close="true" data-oanix-save-and-close="true" aria-label="Guardar y volver" disabled={editingDisabled} onClick={() => void requestClose()}><BackIcon /></button>
        <span className="oanix-replica-v16__separator" aria-hidden="true" />
        <div className="oanix-replica-v16__brand"><b>✦</b><span>Bitácora</span></div>
        <div className="oanix-replica-v16__status" role="status" aria-live="polite">
          <i aria-hidden="true" />{autosaveVisible || saving ? 'Guardando…' : dirty ? 'Pendiente' : 'Guardado'}
        </div>
      </header>

      {error && <div className="oanix-replica-v16__error" role="alert">{error}</div>}

      <main className="oanix-replica-v16__page">
        <div className="oanix-replica-v16__canvas">
          <div className="oanix-replica-v16__meta">
            <span className="oanix-replica-v16__chip">Nota</span>
            <span aria-hidden="true">•</span>
            <span className="oanix-replica-v16__saved"><i aria-hidden="true" />{dirty ? 'Cambios pendientes' : 'Guardado local'}</span>
          </div>

          <textarea
            ref={titleRef}
            className="oanix-replica-v16__title"
            defaultValue={initialTitle}
            maxLength={160}
            rows={1}
            autoComplete="off"
            aria-label="Título de la nota"
            readOnly={editingDisabled}
            onInput={markActivity}
          />

          <div className="oanix-replica-v16__tagline" aria-label="Etiquetas de la nota">
            <span className="oanix-replica-v16__tag"># nota</span>
            <span className="oanix-replica-v16__tag-hint">Etiquetas conectadas después al modelo de OANIX</span>
          </div>

          <section className="oanix-replica-v16__editing-sheet" aria-label="Hoja de edición">
            <span className="oanix-replica-v16__sheet-label">HOJA DE EDICIÓN</span>
            <textarea
              ref={bodyRef}
              className="oanix-replica-v16__body"
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

            {blockSession && (
              <QwenRichBlocks
                session={blockSession}
                disabled={editingDisabled}
                onActivity={markActivity}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                externalInsertRequest={insertRequest}
              />
            )}

            {attachmentsEnabled && (
              <ReplicaV16Attachments
                disabled={editingDisabled}
                blockSession={blockSession}
                loadAttachments={loadAttachments}
                onRequestAttachmentStore={onRequestAttachmentStore}
                loadAttachmentFile={loadAttachmentFile}
                onRequestAttachmentRemove={onRequestAttachmentRemove}
                onActivity={markActivity}
                insertRequest={attachmentInsertRequest}
              />
            )}
            <div className="oanix-replica-v16__tail" aria-hidden="true" />
          </section>
        </div>
      </main>

      <div ref={controlsRef} className="oanix-replica-v16__floating" aria-label="Herramientas de nota">
        <button
          type="button"
          className="oanix-replica-v16__float-button oanix-replica-v16__float-button--primary"
          aria-label="Insertar bloque"
          aria-expanded={insertMenuOpen}
          disabled={(!blockSession && !attachmentsEnabled) || editingDisabled}
          onClick={() => {
            setToolsMenuOpen(false)
            setInsertMenuOpen((open) => !open)
          }}
        ><PlusIcon /></button>
        <button
          type="button"
          className="oanix-replica-v16__float-button"
          aria-label="Herramientas rápidas"
          aria-expanded={toolsMenuOpen}
          onClick={() => {
            setInsertMenuOpen(false)
            setToolsMenuOpen((open) => !open)
          }}
        ><SlidersIcon /></button>

        {insertMenuOpen && (
          <div className="oanix-replica-v16__floating-menu" role="menu" aria-label="Insertar bloque">
            {blockSession && <button type="button" role="menuitem" onClick={() => requestInsert('text')}><strong>Texto</strong><small>Continuar la nota</small></button>}
            {blockSession && <button type="button" role="menuitem" onClick={() => requestInsert('entry')}><strong>Entrada</strong><small>Registro con fecha</small></button>}
            {attachmentsEnabled && <button type="button" role="menuitem" onClick={() => requestAttachmentInsert('image')}><strong>Imagen</strong><small>Asset cifrado de OANIX</small></button>}
            {attachmentsEnabled && <button type="button" role="menuitem" onClick={() => requestAttachmentInsert('file')}><strong>Archivo</strong><small>Adjunto cifrado</small></button>}
            {blockSession && <button type="button" role="menuitem" onClick={() => requestInsert('checklist')}><strong>Checklist</strong><small>Lista de tareas</small></button>}
            {blockSession && <button type="button" role="menuitem" onClick={() => requestInsert('contact')}><strong>Contacto</strong><small>Nombre y referencia</small></button>}
            {blockSession && <button type="button" role="menuitem" onClick={() => requestInsert('separator')}><strong>Separador</strong><small>Línea de división</small></button>}
            {blockSession && <button type="button" role="menuitem" onClick={() => requestInsert('code')}><strong>Código</strong><small>Fragmento técnico</small></button>}
          </div>
        )}

        {toolsMenuOpen && (
          <div className="oanix-replica-v16__floating-menu oanix-replica-v16__floating-menu--tools" role="menu" aria-label="Diseño de hoja">
            <span>Diseño de hoja</span>
            {([
              ['plain', 'Liso'],
              ['ruled', 'Renglones'],
              ['dots', 'Puntos'],
              ['grid', 'Cuadrícula'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" role="menuitemradio" aria-checked={design === value} className={design === value ? 'is-active' : ''} onClick={() => { setDesign(value); setToolsMenuOpen(false) }}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
