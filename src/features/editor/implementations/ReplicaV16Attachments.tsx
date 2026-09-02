import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { EditorBlockSession } from '../editorBlockSession.ts'
import type { EditorSurfaceAttachment, EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import {
  createReplicaAttachmentFlowRef,
  decodeReplicaAttachmentFlowRef,
  encodeReplicaAttachmentFlowRef,
  type ReplicaAttachmentFlowRef,
  type ReplicaAttachmentFlowType,
} from '../replicaAttachmentFlowCodec.ts'
import {
  replicaFlowIndexToOrderIndex,
  splitReplicaEditorBlocks,
} from '../replicaAttachmentFlowOrder.ts'
import {
  MAX_REPLICA_IMAGE_DESCRIPTION,
  MAX_REPLICA_IMAGE_WIDTH,
  MIN_REPLICA_IMAGE_WIDTH,
  createReplicaAttachmentPresentation,
  decodeReplicaAttachmentPresentation,
  encodeReplicaAttachmentPresentation,
  type ReplicaAttachmentPresentation,
} from '../replicaAttachmentPresentationCodec.ts'
import {
  createReplicaRetiredAttachment,
  decodeReplicaRetiredAttachment,
  encodeReplicaRetiredAttachment,
} from '../replicaRetiredAttachmentCodec.ts'
import './replicaV16Attachments.css'

export type ReplicaAttachmentInsertKind = ReplicaAttachmentFlowType

export interface ReplicaAttachmentInsertRequest {
  token: number
  kind: ReplicaAttachmentInsertKind
}

interface ReplicaV16AttachmentsProps {
  disabled: boolean
  blockSession?: EditorBlockSession | null
  loadAttachments?: () => Promise<EditorSurfaceAttachment[]>
  onRequestAttachmentStore?: (file: File) => Promise<EditorSurfaceAttachment>
  loadAttachmentFile?: (attachmentId: string) => Promise<File | null>
  onRequestAttachmentRemove?: (attachmentId: string) => Promise<boolean>
  onActivity: () => void
  insertRequest?: ReplicaAttachmentInsertRequest | null
  children?: ReactNode
}

interface PendingAttachmentInsert {
  kind: ReplicaAttachmentInsertKind
  flowIndex: number | null
}

interface ReplicaV16AttachmentFlowContextValue {
  enabled: boolean
  revision: number
  busy: boolean
  items: EditorSurfaceAttachment[]
  presentations: Record<string, ReplicaAttachmentPresentation>
  activeMenuId: string | null
  requestInsert: (kind: ReplicaAttachmentInsertKind, flowIndex: number) => void
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  queuePresentation: (next: ReplicaAttachmentPresentation) => void
  replace: (oldItem: EditorSurfaceAttachment, file: File) => Promise<void>
  remove: (item: EditorSurfaceAttachment) => Promise<void>
  openFile: (item: EditorSurfaceAttachment) => Promise<void>
  setActiveMenuId: (attachmentId: string | null) => void
  setError: (message: string) => void
}

const ReplicaV16AttachmentFlowContext = createContext<ReplicaV16AttachmentFlowContextValue | null>(null)

export function useReplicaV16AttachmentFlow(): ReplicaV16AttachmentFlowContextValue | null {
  return useContext(ReplicaV16AttachmentFlowContext)
}

function humanBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

function isImage(item: EditorSurfaceAttachment): boolean {
  return item.mimeType.toLocaleLowerCase().startsWith('image/')
}

function FileIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h5" /></svg>
}

function ImageIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m5 17 5-5 4 4 2-2 3 3M9 9h.01" /></svg>
}

function MoreIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
}

interface ImageCardProps {
  blockId?: string
  item: EditorSurfaceAttachment
  presentation: ReplicaAttachmentPresentation
  disabled: boolean
  active: boolean
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onToggleMenu: () => void
  onPresentationChange: (next: ReplicaAttachmentPresentation) => void
  onReplace: (oldItem: EditorSurfaceAttachment, file: File) => Promise<void>
  onRemove: (item: EditorSurfaceAttachment) => Promise<void>
  onError: (message: string) => void
}

function ImageCard({
  blockId,
  item,
  presentation,
  disabled,
  active,
  loadAttachmentFile,
  onToggleMenu,
  onPresentationChange,
  onReplace,
  onRemove,
  onError,
}: ImageCardProps) {
  const hostRef = useRef<HTMLElement | null>(null)
  const replaceRef = useRef<HTMLInputElement | null>(null)
  const loadStartedRef = useRef(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadRequested, setLoadRequested] = useState(false)

  useEffect(() => {
    if (item.remote) return
    const host = hostRef.current
    if (!host || loadRequested) return
    if (!('IntersectionObserver' in window)) {
      setLoadRequested(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setLoadRequested(true)
      observer.disconnect()
    }, { rootMargin: '320px 0px' })
    observer.observe(host)
    return () => observer.disconnect()
  }, [item.remote, loadRequested])

  useEffect(() => {
    if (item.remote || !loadRequested || url || loadStartedRef.current) return
    let activeEffect = true
    loadStartedRef.current = true
    setLoading(true)
    void loadAttachmentFile(item.id).then((file) => {
      if (!activeEffect) return
      if (!file) {
        onError('No se pudo abrir la imagen cifrada.')
        return
      }
      setUrl(URL.createObjectURL(file))
    }).catch(() => {
      if (activeEffect) onError('No se pudo abrir la imagen cifrada.')
    }).finally(() => {
      if (activeEffect) setLoading(false)
    })
    return () => { activeEffect = false }
  }, [item.id, item.remote, loadAttachmentFile, loadRequested, onError, url])

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])

  const figureStyle = { '--replica-image-width': `${presentation.widthPercent}%` } as CSSProperties
  const figureClass = `oanix-replica-asset oanix-replica-asset--image align-${presentation.alignment}${presentation.locked ? '' : ' is-unlocked'}`

  function editDescription() {
    const next = window.prompt('Descripción de la imagen', presentation.description)
    if (next === null) return
    onPresentationChange({
      ...presentation,
      description: next.slice(0, MAX_REPLICA_IMAGE_DESCRIPTION),
    })
  }

  return <article ref={hostRef} className={figureClass} style={figureStyle} data-oanix-block-id={blockId} data-oanix-attachment-id={item.id}>
    <button type="button" className="oanix-replica-asset__more" aria-label={`Opciones de ${item.name}`} aria-expanded={active} disabled={disabled} onClick={onToggleMenu}><MoreIcon /></button>
    <div className="oanix-replica-asset__image-stage">
      {url ? <img src={url} alt={presentation.description || item.name} loading="lazy" /> : <div className="oanix-replica-asset__placeholder"><ImageIcon /><span>{item.remote ? 'Imagen remota cifrada' : loading ? 'Descifrando imagen…' : 'Imagen cifrada'}</span></div>}
    </div>
    {(presentation.showName || presentation.description) && <div className="oanix-replica-asset__caption">
      {presentation.showName && <strong>{item.name}</strong>}
      {presentation.description && <em>{presentation.description}</em>}
      <span>{humanBytes(item.byteLength)}{item.remote ? ' · remoto' : ''}</span>
    </div>}
    {active && <div className="oanix-replica-asset__menu" role="menu" aria-label={`Opciones de imagen ${item.name}`}>
      <button type="button" role="menuitem" disabled={!url} onClick={() => { if (url) window.open(url, '_blank', 'noopener,noreferrer') }}>Abrir</button>
      <button type="button" role="menuitem" disabled={disabled} onClick={() => replaceRef.current?.click()}>Reemplazar</button>
      <button type="button" role="menuitemcheckbox" aria-checked={presentation.locked} disabled={disabled} onClick={() => onPresentationChange({ ...presentation, locked: !presentation.locked })}>{presentation.locked ? 'Desbloquear tamaño' : 'Bloquear tamaño'}</button>
      {!presentation.locked && <label className="oanix-replica-asset__size-control">
        <span>Tamaño {presentation.widthPercent}%</span>
        <input type="range" min={MIN_REPLICA_IMAGE_WIDTH} max={MAX_REPLICA_IMAGE_WIDTH} value={presentation.widthPercent} disabled={disabled} onChange={(event) => onPresentationChange({ ...presentation, widthPercent: Number(event.target.value) })} />
      </label>}
      <div className="oanix-replica-asset__align" role="group" aria-label="Alineación de imagen">
        {(['left', 'center', 'right'] as const).map((alignment) => <button key={alignment} type="button" className={presentation.alignment === alignment ? 'is-active' : ''} aria-pressed={presentation.alignment === alignment} disabled={disabled} onClick={() => onPresentationChange({ ...presentation, alignment })}>{alignment === 'left' ? 'Izq.' : alignment === 'center' ? 'Centro' : 'Der.'}</button>)}
      </div>
      <button type="button" role="menuitemcheckbox" aria-checked={presentation.showName} disabled={disabled} onClick={() => onPresentationChange({ ...presentation, showName: !presentation.showName })}>{presentation.showName ? 'Ocultar nombre' : 'Mostrar nombre'}</button>
      <button type="button" role="menuitem" disabled={disabled} onClick={editDescription}>{presentation.description ? 'Editar descripción' : 'Añadir descripción'}</button>
      <button type="button" role="menuitem" onClick={() => window.alert(`${item.name}\n${item.mimeType || 'tipo desconocido'}\n${humanBytes(item.byteLength)}\nAncho ${presentation.widthPercent}% · ${presentation.alignment}${item.remote ? '\nAdjunto remoto cifrado' : '\nAdjunto local cifrado'}`)}>Información</button>
      <button type="button" role="menuitem" className="is-danger" disabled={disabled} onClick={() => void onRemove(item)}>Eliminar</button>
    </div>}
    <input ref={replaceRef} className="oanix-replica-asset__hidden-input" type="file" accept="image/*" tabIndex={-1} onChange={(event) => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) void onReplace(item, file)
    }} />
  </article>
}

function flowRefsForAttachment(blocks: readonly EditorSurfaceBlock[], attachmentId: string): ReplicaAttachmentFlowRef[] {
  return blocks.flatMap((block) => {
    const ref = decodeReplicaAttachmentFlowRef(block)
    return ref?.attachmentId === attachmentId ? [ref] : []
  })
}

export function ReplicaV16AttachmentBlock({
  flowRef,
  disabled,
}: {
  flowRef: ReplicaAttachmentFlowRef
  disabled: boolean
}) {
  const context = useReplicaV16AttachmentFlow()
  const item = context?.items.find((candidate) => candidate.id === flowRef.attachmentId)

  if (!context || !item) {
    return <article className="oanix-replica-asset oanix-replica-asset--file" data-oanix-block-id={flowRef.id} data-oanix-missing-attachment={flowRef.attachmentId}>
      <span className="oanix-replica-asset__file-icon" aria-hidden="true"><FileIcon /></span>
      <span className="oanix-replica-asset__file-copy"><strong>Adjunto no disponible</strong><small>La referencia cifrada se conserva en la nota.</small></span>
    </article>
  }

  if (flowRef.attachmentType === 'image') {
    const presentation = context.presentations[item.id] ?? createReplicaAttachmentPresentation(item.id)
    return <ImageCard
      blockId={flowRef.id}
      item={item}
      presentation={presentation}
      disabled={disabled || context.busy}
      active={context.activeMenuId === item.id}
      loadAttachmentFile={context.loadAttachmentFile}
      onToggleMenu={() => context.setActiveMenuId(context.activeMenuId === item.id ? null : item.id)}
      onPresentationChange={context.queuePresentation}
      onReplace={context.replace}
      onRemove={context.remove}
      onError={context.setError}
    />
  }

  return <article className="oanix-replica-asset oanix-replica-asset--file" data-oanix-block-id={flowRef.id} data-oanix-attachment-id={item.id}>
    <span className="oanix-replica-asset__file-icon" aria-hidden="true"><FileIcon /></span>
    <span className="oanix-replica-asset__file-copy"><strong>{item.name}</strong><small>{item.mimeType || 'Archivo'} · {humanBytes(item.byteLength)}{item.remote ? ' · remoto' : ''}</small></span>
    <button type="button" disabled={disabled || context.busy || item.remote} title={item.remote ? 'La recuperación por streaming se conectará en el siguiente bloque.' : undefined} onClick={() => void context.openFile(item)}>Abrir</button>
    <button type="button" className="is-danger" disabled={disabled || context.busy} onClick={() => void context.remove(item)}>Eliminar</button>
  </article>
}

export function ReplicaV16Attachments({
  disabled,
  blockSession = null,
  loadAttachments,
  onRequestAttachmentStore,
  loadAttachmentFile,
  onRequestAttachmentRemove,
  onActivity,
  insertRequest = null,
  children,
}: ReplicaV16AttachmentsProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const consumedInsertRef = useRef<number | null>(null)
  const pendingInsertRef = useRef<PendingAttachmentInsert | null>(null)
  const [items, setItems] = useState<EditorSurfaceAttachment[]>([])
  const [presentations, setPresentations] = useState<Record<string, ReplicaAttachmentPresentation>>({})
  const [loading, setLoading] = useState(Boolean(loadAttachments))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const enabled = Boolean(loadAttachments && onRequestAttachmentStore && loadAttachmentFile && onRequestAttachmentRemove)

  useEffect(() => {
    if (!loadAttachments) return
    let active = true

    void (async () => {
      setLoading(true)
      try {
        const [loaded, initialBlocks] = await Promise.all([
          loadAttachments(),
          blockSession?.load() ?? Promise.resolve([]),
        ])
        if (!active) return

        const nextPresentations: Record<string, ReplicaAttachmentPresentation> = {}
        const anchoredIds = new Set<string>()
        const retiredIds = new Set<string>()
        for (const block of initialBlocks) {
          const presentation = decodeReplicaAttachmentPresentation(block)
          if (presentation) nextPresentations[presentation.attachmentId] = presentation
          const flowRef = decodeReplicaAttachmentFlowRef(block)
          if (flowRef) anchoredIds.add(flowRef.attachmentId)
          const retired = decodeReplicaRetiredAttachment(block)
          if (retired) retiredIds.add(retired.attachmentId)
        }

        setItems(loaded)
        setPresentations(nextPresentations)
        setError('')

        if (!blockSession) return
        let workingBlocks = [...initialBlocks]
        let migrated = false
        for (const item of loaded) {
          if (anchoredIds.has(item.id) || retiredIds.has(item.id)) continue
          const flowRef = createReplicaAttachmentFlowRef(item.id, isImage(item) ? 'image' : 'file')
          const encoded = encodeReplicaAttachmentFlowRef(flowRef)
          const flowIndex = splitReplicaEditorBlocks(workingBlocks).flowBlocks.length
          const rawIndex = replicaFlowIndexToOrderIndex(workingBlocks, flowIndex)
          await blockSession.insert(encoded, rawIndex)
          workingBlocks = [
            ...workingBlocks.slice(0, rawIndex),
            encoded,
            ...workingBlocks.slice(rawIndex),
          ]
          anchoredIds.add(item.id)
          migrated = true
        }

        if (migrated && active) {
          setRevision((current) => current + 1)
          onActivity()
        }
      } catch {
        if (active) setError('No se pudieron abrir los adjuntos de esta nota.')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [blockSession, loadAttachments, onActivity])

  function requestInsert(kind: ReplicaAttachmentInsertKind, flowIndex: number | null) {
    if (disabled || loading || busy || !enabled) return
    pendingInsertRef.current = { kind, flowIndex }
    if (kind === 'image') imageInputRef.current?.click()
    else fileInputRef.current?.click()
  }

  useEffect(() => {
    if (!insertRequest || disabled || loading || !enabled) return
    if (consumedInsertRef.current === insertRequest.token) return
    consumedInsertRef.current = insertRequest.token
    requestInsert(insertRequest.kind, null)
  }, [disabled, enabled, insertRequest, loading])

  useEffect(() => {
    function closeMenu(event: PointerEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('.oanix-replica-asset')) return
      setActiveMenuId(null)
    }
    function escapeMenu(event: KeyboardEvent) {
      if (event.key === 'Escape') setActiveMenuId(null)
    }
    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', escapeMenu)
    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', escapeMenu)
    }
  }, [])

  function presentationFor(item: EditorSurfaceAttachment): ReplicaAttachmentPresentation {
    return presentations[item.id] ?? createReplicaAttachmentPresentation(item.id)
  }

  function queuePresentation(next: ReplicaAttachmentPresentation) {
    setPresentations((current) => ({ ...current, [next.attachmentId]: next }))
    onActivity()
    if (!blockSession) return
    void blockSession.upsert(encodeReplicaAttachmentPresentation(next)).catch(() => {
      setError('No se pudo guardar la presentación de la imagen.')
    })
  }

  async function store(file: File, pending: PendingAttachmentInsert) {
    if (!onRequestAttachmentStore || loading || busy) return
    setBusy(true)
    setError('')
    try {
      const stored = await onRequestAttachmentStore(file)
      let presentation: ReplicaAttachmentPresentation | null = null

      if (blockSession) {
        const blocks = await blockSession.load()
        const visibleCount = splitReplicaEditorBlocks(blocks).flowBlocks.length
        const requestedIndex = pending.flowIndex === null
          ? visibleCount
          : Math.min(Math.max(0, pending.flowIndex), visibleCount)
        const flowRef = createReplicaAttachmentFlowRef(stored.id, pending.kind)
        const encoded = encodeReplicaAttachmentFlowRef(flowRef)
        const rawIndex = replicaFlowIndexToOrderIndex(blocks, requestedIndex)
        await blockSession.insert(encoded, rawIndex)

        if (pending.kind === 'image') {
          presentation = createReplicaAttachmentPresentation(stored.id)
          await blockSession.upsert(encodeReplicaAttachmentPresentation(presentation))
        }
      }

      setItems((current) => [...current, stored])
      if (presentation) {
        setPresentations((current) => ({ ...current, [stored.id]: presentation! }))
      }
      setRevision((current) => current + 1)
      onActivity()
    } catch {
      setError('No se pudo guardar el adjunto de forma cifrada.')
    } finally {
      setBusy(false)
    }
  }

  async function replace(oldItem: EditorSurfaceAttachment, file: File) {
    if (!onRequestAttachmentStore || !onRequestAttachmentRemove || loading || busy) return
    setBusy(true)
    setError('')
    try {
      const stored = await onRequestAttachmentStore(file)
      const oldPresentation = presentations[oldItem.id]
      let retiredMarkerId: string | null = null

      if (blockSession) {
        const blocks = await blockSession.load()
        const retired = createReplicaRetiredAttachment(oldItem.id)
        retiredMarkerId = retired.id
        await blockSession.upsert(encodeReplicaRetiredAttachment(retired))

        const refs = flowRefsForAttachment(blocks, oldItem.id)
        for (const flowRef of refs) {
          await blockSession.upsert(encodeReplicaAttachmentFlowRef({
            ...flowRef,
            attachmentId: stored.id,
          }))
        }

        if (oldPresentation) {
          const transferred = { ...oldPresentation, attachmentId: stored.id }
          await blockSession.upsert(encodeReplicaAttachmentPresentation(transferred))
          setPresentations((current) => {
            const next = { ...current }
            delete next[oldItem.id]
            next[stored.id] = transferred
            return next
          })
        } else {
          const newPresentation = createReplicaAttachmentPresentation(stored.id)
          await blockSession.upsert(encodeReplicaAttachmentPresentation(newPresentation))
          setPresentations((current) => ({ ...current, [stored.id]: newPresentation }))
        }
      }

      const removed = await onRequestAttachmentRemove(oldItem.id)
      if (removed) {
        if (blockSession && retiredMarkerId) await blockSession.remove(retiredMarkerId)
        setItems((current) => current.map((item) => item.id === oldItem.id ? stored : item))
      } else {
        setItems((current) => [...current, stored])
        setError('La imagen nueva se guardó y quedó referenciada; la anterior no pudo eliminarse y quedó retirada del flujo para que no reaparezca.')
      }
      setActiveMenuId(null)
      setRevision((current) => current + 1)
      onActivity()
    } catch {
      setError('No se pudo reemplazar la imagen.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: EditorSurfaceAttachment) {
    if (!onRequestAttachmentRemove || loading || busy) return
    if (!window.confirm(`¿Eliminar “${item.name}”?`)) return
    setBusy(true)
    setError('')
    try {
      if (!(await onRequestAttachmentRemove(item.id))) throw new Error('remove-failed')

      if (blockSession) {
        const blocks = await blockSession.load()
        const refs = flowRefsForAttachment(blocks, item.id)
        for (const flowRef of refs) await blockSession.remove(flowRef.id)
        for (const block of blocks) {
          const presentation = decodeReplicaAttachmentPresentation(block)
          if (presentation?.attachmentId === item.id) await blockSession.remove(presentation.id)
          const retired = decodeReplicaRetiredAttachment(block)
          if (retired?.attachmentId === item.id) await blockSession.remove(retired.id)
        }
      }

      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
      setPresentations((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      setActiveMenuId(null)
      setRevision((current) => current + 1)
      onActivity()
    } catch {
      setError('No se pudo eliminar el adjunto.')
    } finally {
      setBusy(false)
    }
  }

  async function openFile(item: EditorSurfaceAttachment) {
    if (!loadAttachmentFile || loading || busy || item.remote) return
    setBusy(true)
    setError('')
    try {
      const file = await loadAttachmentFile(item.id)
      if (!file) throw new Error('missing-file')
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = item.name
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
    } catch {
      setError('No se pudo abrir el archivo cifrado.')
    } finally {
      setBusy(false)
    }
  }

  if (!enabled && !loading) return <>{children}</>

  const context: ReplicaV16AttachmentFlowContextValue | null = enabled && loadAttachmentFile
    ? {
      enabled,
      revision,
      busy: busy || loading,
      items,
      presentations,
      activeMenuId,
      requestInsert: (kind, flowIndex) => requestInsert(kind, flowIndex),
      loadAttachmentFile,
      queuePresentation,
      replace,
      remove,
      openFile,
      setActiveMenuId,
      setError,
    }
    : null

  const legacyImages = blockSession ? [] : items.filter(isImage)
  const legacyFiles = blockSession ? [] : items.filter((item) => !isImage(item))

  return <ReplicaV16AttachmentFlowContext.Provider value={context}>
    {children}
    {(loading || error || legacyImages.length > 0 || legacyFiles.length > 0) && <section className="oanix-replica-assets" aria-label="Imágenes y archivos de la nota" aria-busy={loading || busy}>
      {loading && <p className="oanix-replica-assets__status" role="status">Abriendo referencias de adjuntos…</p>}
      {error && <p className="oanix-replica-assets__error" role="alert">{error}</p>}
      {legacyImages.map((item) => <ImageCard
        key={item.id}
        item={item}
        presentation={presentationFor(item)}
        disabled={disabled || loading || busy}
        active={activeMenuId === item.id}
        loadAttachmentFile={loadAttachmentFile!}
        onToggleMenu={() => setActiveMenuId((current) => current === item.id ? null : item.id)}
        onPresentationChange={queuePresentation}
        onReplace={replace}
        onRemove={remove}
        onError={setError}
      />)}
      {legacyFiles.map((item) => <article key={item.id} className="oanix-replica-asset oanix-replica-asset--file" data-oanix-attachment-id={item.id}>
        <span className="oanix-replica-asset__file-icon" aria-hidden="true"><FileIcon /></span>
        <span className="oanix-replica-asset__file-copy"><strong>{item.name}</strong><small>{item.mimeType || 'Archivo'} · {humanBytes(item.byteLength)}{item.remote ? ' · remoto' : ''}</small></span>
        <button type="button" disabled={disabled || loading || busy || item.remote} title={item.remote ? 'La recuperación por streaming se conectará en el siguiente bloque.' : undefined} onClick={() => void openFile(item)}>Abrir</button>
        <button type="button" className="is-danger" disabled={disabled || loading || busy} onClick={() => void remove(item)}>Eliminar</button>
      </article>)}
    </section>}

    <input ref={imageInputRef} className="oanix-replica-asset__hidden-input" type="file" accept="image/*" tabIndex={-1} disabled={loading || busy} onChange={(event) => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      const pending = pendingInsertRef.current ?? { kind: 'image' as const, flowIndex: null }
      pendingInsertRef.current = null
      if (file) void store(file, { ...pending, kind: 'image' })
    }} />
    <input ref={fileInputRef} className="oanix-replica-asset__hidden-input" type="file" tabIndex={-1} disabled={loading || busy} onChange={(event) => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      const pending = pendingInsertRef.current ?? { kind: 'file' as const, flowIndex: null }
      pendingInsertRef.current = null
      if (file) void store(file, { ...pending, kind: 'file' })
    }} />
  </ReplicaV16AttachmentFlowContext.Provider>
}
