import { useEffect, useRef, useState } from 'react'
import { createEditorBlockSession, type EditorBlockSession } from '../editorBlockSession'
import type { EditorSurfaceProps, EditorSurfaceSnapshot } from '../editorSurfaceContract'
import {
  QwenRichBlocks,
  type QwenExternalInsertKind,
  type QwenExternalInsertRequest,
} from './QwenRichBlocks'
import { ReplicaV16Attachments } from './ReplicaV16Attachments'
import './continuousSheetSurface.css'
import './continuousSheetInteraction.css'

const AUTOSAVE_IDLE_MS = 2_200

type SheetDesign = 'plain' | 'ruled' | 'dots' | 'grid'

function sameSnapshot(left: EditorSurfaceSnapshot, right: EditorSurfaceSnapshot) {
  return left.title === right.title && left.text === right.text
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5 8 12l7.5 7.5" /></svg>
}

function RailIcon({ open }: { open: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={open ? 'M15 5 8 12l7 7' : 'm9 5 7 7-7 7'} /></svg>
}

function MoreIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.35"/><circle cx="12" cy="12" r="1.35"/><circle cx="19" cy="12" r="1.35"/></svg>
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
  const bodyCursorRef = useRef({ active: false, position: 0 })
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
  const [railOpen, setRailOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [design, setDesign] = useState<SheetDesign>('plain')
  const [activeInsertionIndex, setActiveInsertionIndex] = useState(0)
  const [insertRequest, setInsertRequest] = useState<QwenExternalInsertRequest | null>(null)
  const insertTokenRef = useRef(0)

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

  function rememberBodyCursor() {
    const body = bodyRef.current
    if (!body) return
    bodyCursorRef.current = {
      active: true,
      position: body.selectionStart ?? body.value.length,
    }
    setActiveInsertionIndex(0)
  }

  function handleBodyCompositionEnd() {
    handleCompositionEnd()
    rememberBodyCursor()
  }

  function handleFlowInsertionIndex(index: number) {
    bodyCursorRef.current.active = false
    setActiveInsertionIndex(index)
  }

  async function closeEditor() {
    if (saving || closingRef.current) return
    closingRef.current = true
    setClosing(true)
    clearSaveTimer()
    setRailOpen(false)
    setMoreOpen(false)

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

  function requestInsert(kind: QwenExternalInsertKind) {
    insertTokenRef.current += 1
    const body = bodyRef.current
    const cursor = bodyCursorRef.current
    const legacySplit = body && cursor.active
      ? {
          before: body.value.slice(0, cursor.position),
          after: body.value.slice(cursor.position),
        }
      : undefined

    setInsertRequest({
      token: insertTokenRef.current,
      kind,
      index: legacySplit ? 0 : activeInsertionIndex,
      legacySplit,
    })
    setRailOpen(false)
  }

  function selectDesign(nextDesign: SheetDesign) {
    setDesign(nextDesign)
    setRailOpen(false)
  }

  function handleExternalInsertPrepared(token: number) {
    if (!insertRequest?.legacySplit || insertRequest.token !== token) return
    const body = bodyRef.current
    if (body) body.value = ''
    bodyCursorRef.current = { active: false, position: 0 }
    markActivity()
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
      onInsertionIndexChange={handleFlowInsertionIndex}
      onExternalInsertPrepared={handleExternalInsertPrepared}
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
    <header className="oanix-continuous-sheet__header" data-ui-block="header">
      <button type="button" className="oanix-continuous-sheet__back" aria-label="Guardar y volver" disabled={disabled} onClick={() => void closeEditor()}><BackIcon /></button>
      <div className="oanix-continuous-sheet__identity">
        <span className="oanix-continuous-sheet__mark" aria-hidden="true">✦</span>
        <span>OANIX</span>
      </div>
      <div className="oanix-continuous-sheet__header-actions">
        <div className="oanix-continuous-sheet__save" role="status"><i />{saving ? 'Guardando…' : dirty ? 'Editando' : 'Guardado'}</div>
        <button type="button" className="oanix-continuous-sheet__more" aria-label="Más opciones" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}><MoreIcon /></button>
        {moreOpen && <div className="oanix-continuous-sheet__more-menu" role="menu">
          <button type="button" onClick={() => { setMoreOpen(false); void saveNow() }}>Guardar ahora</button>
          <button type="button" onClick={() => { setMoreOpen(false); setRailOpen(true) }}>Personalizar hoja</button>
        </div>}
      </div>
    </header>

    {error && <div className="oanix-continuous-sheet__error" role="alert">{error}</div>}

    <main className="oanix-continuous-sheet__viewport">
      <article className="oanix-continuous-sheet__paper">
        <div className="oanix-continuous-sheet__paper-glow" aria-hidden="true" />

        <section className="oanix-continuous-sheet__editor-block oanix-continuous-sheet__editor-block--title" data-editor-block="title">
          <textarea
            ref={titleRef}
            className="oanix-continuous-sheet__title"
            defaultValue={initialTitle}
            rows={1}
            maxLength={160}
            aria-label="Título de la nota"
            placeholder="Sin título"
            readOnly={disabled}
            onFocus={() => { bodyCursorRef.current.active = false }}
            onInput={markActivity}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
          />
        </section>

        <div className="oanix-continuous-sheet__rule" />

        <section className="oanix-continuous-sheet__editor-block oanix-continuous-sheet__editor-block--body" data-editor-block="body">
          <textarea
            ref={bodyRef}
            className="oanix-continuous-sheet__body"
            defaultValue={initialText}
            aria-label="Inicio de la nota"
            placeholder="Empieza a escribir…"
            spellCheck
            wrap="soft"
            readOnly={disabled}
            onFocus={rememberBodyCursor}
            onClick={rememberBodyCursor}
            onKeyUp={rememberBodyCursor}
            onSelect={rememberBodyCursor}
            onInput={() => { rememberBodyCursor(); markActivity() }}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleBodyCompositionEnd}
          />
        </section>

        <section className="oanix-continuous-sheet__editor-block oanix-continuous-sheet__flow" data-editor-block="flow">
          {attachmentsEnabled ? <ReplicaV16Attachments
            disabled={disabled}
            blockSession={blockSession}
            loadAttachments={loadAttachments}
            onRequestAttachmentStore={onRequestAttachmentStore}
            loadAttachmentFile={loadAttachmentFile}
            onRequestAttachmentRemove={onRequestAttachmentRemove}
            onActivity={markActivity}
          >{richFlow}</ReplicaV16Attachments> : richFlow}
        </section>
      </article>
    </main>

    <aside className={`oanix-continuous-sheet__rail ${railOpen ? 'is-open' : ''}`} data-ui-block="rail" aria-label="Herramientas de la hoja">
      <button type="button" className="oanix-continuous-sheet__rail-toggle" aria-label={railOpen ? 'Cerrar herramientas' : 'Abrir herramientas'} aria-expanded={railOpen} onClick={() => setRailOpen((open) => !open)}><RailIcon open={railOpen} /></button>

      <div className="oanix-continuous-sheet__rail-panel" aria-hidden={!railOpen}>
        <div className="oanix-continuous-sheet__rail-section">
          <span className="oanix-continuous-sheet__rail-label">Añadir</span>
          <div className="oanix-continuous-sheet__rail-grid">
            {blockSession && <button type="button" onClick={() => requestInsert('text')}><b>¶</b><span>Texto</span></button>}
            {blockSession && <button type="button" onClick={() => requestInsert('entry')}><b>◫</b><span>Entrada</span></button>}
            {attachmentsEnabled && <button type="button" onClick={() => requestInsert('image')}><b>▧</b><span>Imagen</span></button>}
            {attachmentsEnabled && <button type="button" onClick={() => requestInsert('file')}><b>⌑</b><span>Archivo</span></button>}
            {blockSession && <button type="button" onClick={() => requestInsert('checklist')}><b>☑</b><span>Checklist</span></button>}
            {blockSession && <button type="button" onClick={() => requestInsert('contact')}><b>◎</b><span>Contacto</span></button>}
            {blockSession && <button type="button" onClick={() => requestInsert('code')}><b>&lt;/&gt;</b><span>Código</span></button>}
            {blockSession && <button type="button" onClick={() => requestInsert('separator')}><b>—</b><span>Separador</span></button>}
          </div>
        </div>

        <div className="oanix-continuous-sheet__rail-section">
          <span className="oanix-continuous-sheet__rail-label">Superficie</span>
          <div className="oanix-continuous-sheet__rail-designs">
            {(['plain', 'ruled', 'dots', 'grid'] as const).map((option) => <button key={option} type="button" className={design === option ? 'is-active' : ''} onClick={() => selectDesign(option)}>{option === 'plain' ? 'Limpia' : option === 'ruled' ? 'Rayada' : option === 'dots' ? 'Puntos' : 'Cuadrícula'}</button>)}
          </div>
        </div>
      </div>
    </aside>
  </section>
}
