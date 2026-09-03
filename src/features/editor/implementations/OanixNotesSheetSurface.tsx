import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { EditorSurfaceProps, EditorSurfaceSnapshot } from '../editorSurfaceContract'
import './oanixNotesSheetSurface.css'

const AUTOSAVE_IDLE_MS = 3_000
const HANDLE_EDGE_PADDING = 48

type HandleSide = 'left' | 'right'

function snapshotsMatch(left: EditorSurfaceSnapshot, right: EditorSurfaceSnapshot): boolean {
  return left.title === right.title && left.text === right.text
}

function Icon({ children, width = 18, height = 18 }: { children: ReactNode; width?: number; height?: number }) {
  return <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

export function OanixNotesSheetSurface({
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
  const editorRef = useRef<HTMLElement | null>(null)
  const dirtyRef = useRef(false)
  const generationRef = useRef(0)
  const lastActivityAtRef = useRef(0)
  const composingRef = useRef(false)
  const closingRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef<Promise<boolean> | null>(null)
  const committedSnapshotRef = useRef<EditorSurfaceSnapshot>({ title: initialTitle, text: initialText })
  const handleDragRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)

  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [theme, setTheme] = useState('default')
  const [mode, setMode] = useState<'light' | 'dark' | 'auto'>('light')
  const [handleSide, setHandleSide] = useState<HandleSide>('right')
  const [handleY, setHandleY] = useState(0.5)

  function readSnapshot(): EditorSurfaceSnapshot {
    return {
      title: titleRef.current?.value ?? initialTitle,
      text: bodyRef.current?.value ?? initialText,
    }
  }

  function resizeBody() {
    const textarea = bodyRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(280, textarea.scrollHeight)}px`
  }

  function clearIdleTimer() {
    if (idleTimerRef.current === null) return
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }

  function markClean() {
    dirtyRef.current = false
    setDirty(false)
  }

  function armAutosaveTimer() {
    clearIdleTimer()
    if (!dirtyRef.current || closingRef.current || composingRef.current) return
    const elapsed = Math.max(0, Date.now() - lastActivityAtRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      void runAutosaveIfIdle()
    }, Math.max(0, AUTOSAVE_IDLE_MS - elapsed))
  }

  async function saveCurrentSnapshot(): Promise<boolean> {
    if (!dirtyRef.current) return true
    if (saveInFlightRef.current) return saveInFlightRef.current

    const generation = generationRef.current
    const snapshot = readSnapshot()
    if (snapshotsMatch(snapshot, committedSnapshotRef.current)) {
      markClean()
      return true
    }

    const operation = onRequestSave(snapshot).catch(() => false)
    saveInFlightRef.current = operation

    try {
      const succeeded = await operation
      if (succeeded) {
        committedSnapshotRef.current = snapshot
        if (generationRef.current === generation) markClean()
      }
      return succeeded
    } finally {
      if (saveInFlightRef.current === operation) saveInFlightRef.current = null
      if (dirtyRef.current && generationRef.current !== generation && !closingRef.current) armAutosaveTimer()
    }
  }

  async function runAutosaveIfIdle() {
    if (!dirtyRef.current || closingRef.current || composingRef.current) return
    if (saveInFlightRef.current) {
      await saveInFlightRef.current
      if (dirtyRef.current && !closingRef.current) armAutosaveTimer()
      return
    }
    if (Date.now() - lastActivityAtRef.current < AUTOSAVE_IDLE_MS) {
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

  function handleBodyInput() {
    resizeBody()
    markActivity()
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
      closed = snapshotsMatch(snapshot, committedSnapshotRef.current)
        ? await onRequestClose(null)
        : await onRequestClose(snapshot)
      if (closed) {
        committedSnapshotRef.current = snapshot
        markClean()
      }
    } finally {
      if (!closed) {
        closingRef.current = false
        setClosing(false)
        if (dirtyRef.current) armAutosaveTimer()
      }
    }
  }

  function runNativeHistory(command: 'undo' | 'redo') {
    const active = document.activeElement
    if (active !== titleRef.current && active !== bodyRef.current) bodyRef.current?.focus()
    const before = readSnapshot()
    document.execCommand(command)
    window.requestAnimationFrame(() => {
      resizeBody()
      const after = readSnapshot()
      if (!snapshotsMatch(before, after)) markActivity()
    })
  }

  function closeKeyboard() {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }

  function openPanel() {
    closeKeyboard()
    setCustomizeOpen(false)
    setPanelOpen(true)
  }

  function openCustomize() {
    closeKeyboard()
    setPanelOpen(false)
    setCustomizeOpen(true)
  }

  function applyMode(nextMode: 'light' | 'dark' | 'auto') {
    setMode(nextMode)
    if (nextMode === 'dark') setTheme('dark')
    if (nextMode === 'light' && (theme === 'dark' || theme === 'midnight')) setTheme('default')
    if (nextMode === 'auto') {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
      setTheme(prefersDark ? 'dark' : 'default')
    }
  }

  function updateFloatingHandle(clientX: number, clientY: number) {
    const editor = editorRef.current
    if (!editor) return
    const bounds = editor.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    const localY = Math.min(
      Math.max(clientY - bounds.top, HANDLE_EDGE_PADDING),
      Math.max(HANDLE_EDGE_PADDING, bounds.height - HANDLE_EDGE_PADDING),
    )
    setHandleY(localY / bounds.height)
    setHandleSide(clientX - bounds.left < bounds.width / 2 ? 'left' : 'right')
  }

  function handleFloatingPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (panelOpen) return
    handleDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleFloatingPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = handleDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true
    if (!drag.moved) return
    event.preventDefault()
    updateFloatingHandle(event.clientX, event.clientY)
  }

  function finishFloatingPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = handleDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const shouldOpen = !drag.moved
    handleDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (shouldOpen) openPanel()
  }

  useEffect(() => {
    resizeBody()
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    const editor = editorRef.current
    if (!viewport || !editor) return

    const syncVisualViewport = () => {
      editor.style.setProperty('--oanix-visible-height', `${viewport.height}px`)
      editor.style.setProperty('--oanix-viewport-top', `${viewport.offsetTop}px`)
    }

    syncVisualViewport()
    viewport.addEventListener('resize', syncVisualViewport)
    viewport.addEventListener('scroll', syncVisualViewport)
    return () => {
      viewport.removeEventListener('resize', syncVisualViewport)
      viewport.removeEventListener('scroll', syncVisualViewport)
    }
  }, [])

  useEffect(() => () => clearIdleTimer(), [])

  useEffect(() => {
    if (!dirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (mode !== 'auto' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent) => setTheme(event.matches ? 'dark' : 'default')
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [mode])

  const editingDisabled = saving || closing
  const status = saving || saveInFlightRef.current ? 'saving' : dirty ? 'unsaved' : 'saved'
  const statusLabel = status === 'saving' ? 'Guardando…' : status === 'saved' ? 'Guardado' : 'Sin guardar'

  return (
    <section
      ref={editorRef}
      className="oanix-notes"
      data-theme={theme}
      data-note-id={noteId}
      data-unsaved={dirty ? 'true' : 'false'}
      aria-label="Editor de nota"
      aria-busy={editingDisabled}
    >
      <header className="oanix-notes__top-bar">
        <button
          className="oanix-notes__icon-btn"
          type="button"
          aria-label="Volver"
          data-oanix-back-close="true"
          data-oanix-save-and-close="true"
          disabled={editingDisabled}
          onClick={() => void requestClose()}
        >
          <Icon width={20} height={20}><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></Icon>
        </button>
        <div className="oanix-notes__save-status" data-status={status} role="status" aria-live="polite">
          <span className="oanix-notes__status-dot"/><span>{statusLabel}</span>
        </div>
        <div className="oanix-notes__top-actions">
          <button className="oanix-notes__icon-btn oanix-notes__icon-btn--sm" type="button" aria-label="Deshacer" title="Deshacer" onPointerDown={(event) => event.preventDefault()} onClick={() => runNativeHistory('undo')}>
            <Icon width={17} height={17}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></Icon>
          </button>
          <button className="oanix-notes__icon-btn oanix-notes__icon-btn--sm" type="button" aria-label="Rehacer" title="Rehacer" onPointerDown={(event) => event.preventDefault()} onClick={() => runNativeHistory('redo')}>
            <Icon width={17} height={17}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></Icon>
          </button>
          <button className={`oanix-notes__icon-btn oanix-notes__icon-btn--sm${pinned ? ' is-active' : ''}`} type="button" aria-label="Fijar" title="Fijar nota" onClick={() => setPinned((value) => !value)}>
            <Icon width={17} height={17}><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></Icon>
          </button>
          <button className="oanix-notes__icon-btn oanix-notes__icon-btn--sm" type="button" aria-label="Personalizar" title="Personalizar hoja" onClick={openCustomize}>
            <Icon width={17} height={17}><circle cx="13.5" cy="6.5" r="2.5"/><path d="M17 2l-5.5 5.5"/><path d="M22 9l-5.5 5.5"/><path d="M15 13l-8 8-4 1 1-4 8-8"/></Icon>
          </button>
          <button className="oanix-notes__icon-btn oanix-notes__icon-btn--sm" type="button" aria-label="Más" onClick={openPanel}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
          </button>
        </div>
      </header>

      {error && <div className="oanix-notes__error" role="alert">{error}</div>}

      <main className="oanix-notes__editor-container">
        <div className="oanix-notes__sheet">
          <div className="oanix-notes__content">
            <div className="oanix-notes__header">
              <input ref={titleRef} className="oanix-notes__title" type="text" defaultValue={initialTitle} placeholder="Título" maxLength={160} autoComplete="off" autoCapitalize="sentences" spellCheck readOnly={editingDisabled} onInput={markActivity}/>
            </div>
            <div className="oanix-notes__body-wrap">
              <textarea ref={bodyRef} className="oanix-notes__body" defaultValue={initialText} placeholder="Empieza a escribir…" autoComplete="off" autoCapitalize="sentences" spellCheck readOnly={editingDisabled} onInput={handleBodyInput} onCompositionStart={() => { composingRef.current = true; onActivity?.() }} onCompositionEnd={() => { composingRef.current = false; markActivity() }}/>
            </div>
          </div>
        </div>
      </main>

      <button
        className={`oanix-notes__slide-handle${panelOpen ? ' is-hidden' : ''}`}
        type="button"
        aria-label="Abrir o mover menú del editor"
        title="Toca para abrir; arrastra para mover"
        data-side={handleSide}
        style={{ top: `${handleY * 100}%` }}
        onPointerDown={handleFloatingPointerDown}
        onPointerMove={handleFloatingPointerMove}
        onPointerUp={finishFloatingPointer}
        onPointerCancel={finishFloatingPointer}
      >
        <span className="oanix-notes__slide-indicator"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg></span>
      </button>

      <button className={`oanix-notes__panel-overlay${panelOpen ? ' is-active' : ''}`} type="button" aria-label="Cerrar menú" onClick={() => setPanelOpen(false)}/>
      <aside className={`oanix-notes__side-panel${panelOpen ? ' is-active' : ''}`} aria-hidden={!panelOpen}>
        <div className="oanix-notes__panel-header">
          <div><strong>Menú</strong><span>OANIX Editor</span></div>
          <button className="oanix-notes__icon-btn oanix-notes__panel-close" type="button" aria-label="Cerrar" onClick={() => setPanelOpen(false)}><Icon><path d="M18 6L6 18"/><path d="M6 6l12 12"/></Icon></button>
        </div>
        <div className="oanix-notes__panel-body">
          <section className="oanix-notes__panel-section"><span className="oanix-notes__section-label">Etiquetas</span><div className="oanix-notes__tags"><span>Sin etiquetas</span><button type="button" aria-label="Añadir etiqueta"><Icon width={16} height={16}><path d="M12 5v14"/><path d="M5 12h14"/></Icon></button></div></section>
          <div className="oanix-notes__divider"/>
          <ToolSection label="Añadir contenido" tools={[
            ['entry','Entrada'],['image','Imagen'],['file','Archivos'],['code','Código'],['checklist','Checklist'],['contact','Contacto'],['separator','Separador'],
          ]}/>
          <div className="oanix-notes__divider"/>
          <ToolSection label="Formato de texto" tools={[
            ['paragraph','Párrafo'],['h2','H2'],['h3','H3'],['quote','Cita'],['list','Lista'],['numbered-list','Numérica'],
          ]}/>
        </div>
        <div className="oanix-notes__panel-footer">OANIX v0.1</div>
      </aside>

      <button className={`oanix-notes__customize-overlay${customizeOpen ? ' is-active' : ''}`} type="button" aria-label="Cerrar personalización" onClick={() => setCustomizeOpen(false)}/>
      <section className={`oanix-notes__customize${customizeOpen ? ' is-active' : ''}`} aria-hidden={!customizeOpen}>
        <div className="oanix-notes__customize-handle"/>
        <div className="oanix-notes__customize-header"><div><strong>Personalizar</strong><span>Apariencia de la hoja</span></div><button className="oanix-notes__icon-btn" type="button" aria-label="Cerrar" onClick={() => setCustomizeOpen(false)}><Icon><path d="M18 6L6 18"/><path d="M6 6l12 12"/></Icon></button></div>
        <div className="oanix-notes__customize-body">
          <span className="oanix-notes__section-label">Modo</span>
          <div className="oanix-notes__mode-row">{(['light','dark','auto'] as const).map((value) => <button key={value} type="button" className={mode === value ? 'is-active' : ''} onClick={() => applyMode(value)}>{value === 'light' ? 'Día' : value === 'dark' ? 'Noche' : 'Auto'}</button>)}</div>
          <div className="oanix-notes__divider"/>
          <span className="oanix-notes__section-label">Tema de la hoja</span>
          <div className="oanix-notes__theme-grid">{[
            ['default','Claro'],['cream','Crema'],['sepia','Sepia'],['dark','Oscuro'],['midnight','Medianoche'],['forest','Bosque'],['rose','Rosa'],['lavender','Lavanda'],
          ].map(([value,label]) => <button key={value} type="button" className={theme === value ? 'is-active' : ''} onClick={() => setTheme(value)}><span className={`oanix-notes__theme-preview theme-${value}`}/><small>{label}</small></button>)}</div>
        </div>
      </section>
    </section>
  )
}

function ToolSection({ label, tools }: { label: string; tools: Array<[string, string]> }) {
  return <section className="oanix-notes__panel-section"><span className="oanix-notes__section-label">{label}</span><div className="oanix-notes__tool-grid">{tools.map(([tool, label]) => <button key={tool} type="button" className="oanix-notes__tool" data-tool={tool}><span className={`oanix-notes__tool-icon tool-${tool}`}>{toolIcon(tool)}</span><span>{label}</span></button>)}</div></section>
}

function toolIcon(tool: string) {
  switch (tool) {
    case 'image': return <Icon width={24} height={24}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></Icon>
    case 'file': return <Icon width={24} height={24}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></Icon>
    case 'code': return <Icon width={24} height={24}><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></Icon>
    case 'checklist': return <Icon width={24} height={24}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Icon>
    case 'contact': return <Icon width={24} height={24}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>
    case 'separator': return <Icon width={24} height={24}><path d="M3 12h18"/></Icon>
    case 'paragraph': return <Icon width={24} height={24}><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></Icon>
    case 'h2': return <Icon width={24} height={24}><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v8"/></Icon>
    case 'h3': return <Icon width={24} height={24}><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></Icon>
    case 'quote': return <Icon width={24} height={24}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></Icon>
    case 'list': return <Icon width={24} height={24}><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></Icon>
    case 'numbered-list': return <Icon width={24} height={24}><path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></Icon>
    default: return <Icon width={24} height={24}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></Icon>
  }
}