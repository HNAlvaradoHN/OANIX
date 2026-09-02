import { useEffect, useRef, useState } from 'react'
import { createEditorBlockSession, type EditorBlockSession } from '../editorBlockSession'
import type { EditorSurfaceProps, EditorSurfaceSnapshot } from '../editorSurfaceContract'
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
import './continuousSheetSurface.css'

const AUTOSAVE_IDLE_MS = 2_200

type SheetDesign = 'plain' | 'ruled' | 'dots' | 'grid'

function sameSnapshot(left: EditorSurfaceSnapshot, right: EditorSurfaceSnapshot) {
  return left.title === right.title && left.text === right.text
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5 8 12l7.5 7.5" /></svg>
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

function ThemeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6" /></svg>
}

export function ContinuousSheetSurface({
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
  const blockSessionRef = useRef<EditorBlockSession | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const savePromiseRef = useRef<Promise<boolean> | null>(null)
  const dirtyRef = useRef(false)
  const composingRef = useRef(false)
  const closingRef = useRef(false)
  const committedRef = useRef<EditorSurfaceSnapshot>({ title: initialTitle, text: initialText })

  if (!blockSessionRef.current && loadBlocks && onRequestBlockSave) {
    blockSessionRef.current = createEditorBlockSession({ loadBlocks, saveChanges: onRequestBlockSave })
  }

  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [design, setDesign] = useState<SheetDesign>('plain')
  const [activeInsertionIndex, setActiveInsertionIndex] = useState(0)
  const [insertRequest, setInsertRequest] = useState<QwenExternalInsertRequest | null>(null)
  const [attachmentInsertRequest, setAttachmentInsertRequest] = useState<ReplicaAttachmentInsertRequest | null>(null)
  const insertTokenRef = useRef(0)
  const attachmentTokenRef = useRef(0)

  function snapshot(): EditorSurfaceSnapshot {
    return {
      title: titleRef.current?.value ?? initialTitle,
      text: bodyRef.current?.value ?? initialText,
    }
  }

  function clearSaveTimer() {
    if (saveTimerRef.current === null) return
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
  }

  async function saveNow(): Promise<boolean> {
    if (savePromiseRef.current) return savePromiseRef.current
    const current = snapshot()
    const needsTextSave = !sameSnapshot(current, committedRef.current)
    const session = blockSessionRef.current

    const operation = (async () => {
      try {
        if (needsTextSave && !(await onRequestSave(current))) return false
        if (session?.hasPending() && !(await session.flush())) return false
        if (needsTextSave) committedRef.current = current
        dirtyRef.current = false
        setDirty(false)
        return true
      } catch {
        return false
      }
    })()

    savePromiseRef.current = operation
    try {
      return await operation
    } finally {
      if (savePromiseRef.current === operation) savePromiseRef.current = null
    }
  }

  function scheduleSave() {
    if (closingRef.current || composingRef.current) return
    clearSaveTimer()
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void saveNow()
    }, AUTOSAVE_IDLE_MS)
  }

  function markActivity() {
    onActivity?.()
    if (!dirtyRef.current) {
      dirtyRef.current = true
      setDirty(true)
    }
    scheduleSave()
  }

  function handleCompositionStart() {
    composingRef.current = true
    clearSaveTimer()
    onActivity?.()
  }

  function handleCompositionEnd() {
    composingRef.current = false
    markActivity()
  }

  async function closeEditor() {
    if (saving || closingRef.current) return
    closingRef.current = true
    setClosing(true)
    clearSaveTimer()
    setInsertOpen(false)
    setThemeOpen(false)

    let closed = false
    try {
      if (savePromiseRef.current) await savePromiseRef.current
      const session = blockSessionRef.current
      if (session?.hasPending() && !(await session.flush())) return
      const current = snapshot()
      closed = sameSnapshot(current, committedRef.current)
        ? await onRequestClose(null)
        : await onRequestClose(current)
      if (closed) {
        committedRef.current = current
        dirtyRef.current = false
        setDirty(false)
      }
    } finally {
      if (!closed) {
        closingRef.current = false
        setClosing(false)
        if (dirtyRef.current) scheduleSave()
      }
    }
  }

  function requestBlock(kind: QwenInsertBlockKind) {
    insertTokenRef.current += 1
    setInsertRequest({ token: insertTokenRef.current, kind, index: activeInsertionIndex })
    setInsertOpen(false)
  }

  function requestAttachment(kind: ReplicaAttachmentInsertKind) {
    attachmentTokenRef.current += 1
    setAttachmentInsertRequest({ token: attachmentTokenRef.current, kind })
    setInsertOpen(false)
  }

  useEffect(() => () => clearSaveTimer(), [])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const disabled = saving || closing
  const blockSession = blockSessionRef.current
  const attachmentsEnabled = Boolean(loadAttachments && onRequestAttachmentStore && loadAttachmentFile && onRequestAttachmentRemove)
  const className = `oanix-continuous-sheet oanix-continuous-sheet--${design}`

  const richFlow = blockSession ? (
    <QwenRichBlocks
      session={blockSession}
      disabled={disabled}
      onActivity={markActivity}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      externalInsertRequest={insertRequest}
      continuousWriting
      onInsertionIndexChange={setActiveInsertionIndex}
    />
  ) : null

  return <section
    className={className}
    aria-label="Editor continuo OANIX"
    aria-busy={disabled}
    data-oanix-note-id={noteId}
    data-oanix-unsaved={dirty ? 'true' : 'false'}
    data-oanix-sheet="continuous-v1"
  >
    <header className="oanix-continuous-sheet__header">
      <button type="button" className="oanix-continuous-sheet__back" aria-label="Guardar y volver" disabled={disabled} onClick={() => void closeEditor()}><BackIcon /></button>
      <div className="oanix-continuous-sheet__identity">
        <span className="oanix-continuous-sheet__mark" aria-hidden="true">✦</span>
        <span>OANIX</span>
      </div>
      <div className="oanix-continuous-sheet__save" role="status"><i />{saving ? 'Guardando…' : dirty ? 'Editando' : 'Guardado'}</div>
    </header>

    {error && <div className="oanix-continuous-sheet__error" role="alert">{error}</div>}

    <main className="oanix-continuous-sheet__viewport">
      <article className="oanix-continuous-sheet__paper">
        <div className="oanix-continuous-sheet__paper-glow" aria-hidden="true" />
        <textarea
          ref={titleRef}
          className="oanix-continuous-sheet__title"
          defaultValue={initialTitle}
          rows={1}
          maxLength={160}
          aria-label="Título de la nota"
          placeholder="Sin título"
          readOnly={disabled}
          onInput={markActivity}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
        <div className="oanix-continuous-sheet__rule" />
        <textarea
          ref={bodyRef}
          className="oanix-continuous-sheet__body"
          defaultValue={initialText}
          aria-label="Inicio de la nota"
          placeholder="Empieza a escribir…"
          spellCheck
          wrap="soft"
          readOnly={disabled}
          onFocus={() => setActiveInsertionIndex(0)}
          onInput={markActivity}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />

        <div className="oanix-continuous-sheet__flow">
          {attachmentsEnabled ? <ReplicaV16Attachments
            disabled={disabled}
            blockSession={blockSession}
            loadAttachments={loadAttachments}
            onRequestAttachmentStore={onRequestAttachmentStore}
            loadAttachmentFile={loadAttachmentFile}
            onRequestAttachmentRemove={onRequestAttachmentRemove}
            onActivity={markActivity}
            insertRequest={attachmentInsertRequest}
          >{richFlow}</ReplicaV16Attachments> : richFlow}
        </div>
      </article>
    </main>

    <div className="oanix-continuous-sheet__tools">
      <button type="button" className="oanix-continuous-sheet__tool oanix-continuous-sheet__tool--primary" aria-label="Insertar" aria-expanded={insertOpen} disabled={disabled || (!blockSession && !attachmentsEnabled)} onClick={() => { setThemeOpen(false); setInsertOpen((open) => !open) }}><PlusIcon /></button>
      <button type="button" className="oanix-continuous-sheet__tool" aria-label="Personalizar hoja" aria-expanded={themeOpen} onClick={() => { setInsertOpen(false); setThemeOpen((open) => !open) }}><ThemeIcon /></button>

      {insertOpen && <div className="oanix-continuous-sheet__menu oanix-continuous-sheet__menu--insert" role="menu" aria-label="Insertar contenido">
        <div className="oanix-continuous-sheet__menu-title"><strong>Insertar</strong><span>En la posición activa</span></div>
        <div className="oanix-continuous-sheet__insert-grid">
          {blockSession && <button type="button" onClick={() => requestBlock('text')}><b>¶</b><span>Texto</span></button>}
          {blockSession && <button type="button" onClick={() => requestBlock('entry')}><b>◫</b><span>Entrada</span></button>}
          {attachmentsEnabled && <button type="button" onClick={() => requestAttachment('image')}><b>▧</b><span>Imagen</span></button>}
          {attachmentsEnabled && <button type="button" onClick={() => requestAttachment('file')}><b>⌑</b><span>Archivo</span></button>}
          {blockSession && <button type="button" onClick={() => requestBlock('checklist')}><b>☑</b><span>Checklist</span></button>}
          {blockSession && <button type="button" onClick={() => requestBlock('contact')}><b>◎</b><span>Contacto</span></button>}
          {blockSession && <button type="button" onClick={() => requestBlock('code')}><b>&lt;/&gt;</b><span>Código</span></button>}
          {blockSession && <button type="button" onClick={() => requestBlock('separator')}><b>—</b><span>Separador</span></button>}
        </div>
      </div>}

      {themeOpen && <div className="oanix-continuous-sheet__menu oanix-continuous-sheet__menu--theme" role="menu" aria-label="Diseño de hoja">
        <div className="oanix-continuous-sheet__menu-title"><strong>Superficie</strong><span>El contenido no cambia</span></div>
        {(['plain', 'ruled', 'dots', 'grid'] as const).map((option) => <button key={option} type="button" className={design === option ? 'is-active' : ''} onClick={() => { setDesign(option); setThemeOpen(false) }}>
          <span>{option === 'plain' ? 'Limpia' : option === 'ruled' ? 'Rayada' : option === 'dots' ? 'Puntos' : 'Cuadrícula'}</span><i aria-hidden="true" />
        </button>)}
      </div>}
    </div>
  </section>
}
