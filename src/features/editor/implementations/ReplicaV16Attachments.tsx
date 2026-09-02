import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { EditorBlockSession } from '../editorBlockSession.ts'
import type { EditorSurfaceAttachment } from '../editorSurfaceContract'
import {
  MAX_REPLICA_IMAGE_DESCRIPTION,
  MAX_REPLICA_IMAGE_WIDTH,
  MIN_REPLICA_IMAGE_WIDTH,
  createReplicaAttachmentPresentation,
  decodeReplicaAttachmentPresentation,
  encodeReplicaAttachmentPresentation,
  type ReplicaAttachmentPresentation,
} from '../replicaAttachmentPresentationCodec.ts'
import './replicaV16Attachments.css'

export type ReplicaAttachmentInsertKind = 'image' | 'file'

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

  return <article ref={hostRef} className={figureClass} style={figureStyle} data-oanix-attachment-id={item.id}>
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
        <input
          type="range"
          min={MIN_REPLICA_IMAGE_WIDTH}
          max={MAX_REPLICA_IMAGE_WIDTH}
          value={presentation.widthPercent}
          disabled={disabled}
          onChange={(event) => onPresentationChange({ ...presentation, widthPercent: Number(event.target.value) })}
        />
      </label>}
      <div className="oanix-replica-asset__align" role="group" aria-label="Alineación de imagen">
        {(['left', 'center', 'right'] as const).map((alignment) => <button
          key={alignment}
          type="button"
          className={presentation.alignment === alignment ? 'is-active' : ''}
          aria-pressed={presentation.alignment === alignment}
          disabled={disabled}
          onClick={() => onPresentationChange({ ...presentation, alignment })}
        >{alignment === 'left' ? 'Izq.' : alignment === 'center' ? 'Centro' : 'Der.'}</button>)}
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

export function ReplicaV16Attachments({
  disabled,
  blockSession = null,
  loadAttachments,
  onRequestAttachmentStore,
  loadAttachmentFile,
  onRequestAttachmentRemove,
  onActivity,
  insertRequest = null,
}: ReplicaV16AttachmentsProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const consumedInsertRef = useRef<number | null>(null)
  const [items, setItems] = useState<EditorSurfaceAttachment[]>([])
  const [presentations, setPresentations] = useState<Record<string, ReplicaAttachmentPresentation>>({})
  const [loading, setLoading] = useState(Boolean(loadAttachments))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const enabled = Boolean(loadAttachments && onRequestAttachmentStore && loadAttachmentFile && onRequestAttachmentRemove)

  useEffect(() => {
    if (!loadAttachments) return
    let active = true
    setLoading(true)
    const blocksPromise = blockSession?.load() ?? Promise.resolve([])
    void Promise.all([loadAttachments(), blocksPromise]).then(([loaded, blocks]) => {
      if (!active) return
      const nextPresentations: Record<string, ReplicaAttachmentPresentation> = {}
      for (const block of blocks) {
        const presentation = decodeReplicaAttachmentPresentation(block)
        if (presentation) nextPresentations[presentation.attachmentId] = presentation
      }
      setItems(loaded)
      setPresentations(nextPresentations)
      setError('')
    }).catch(() => {
      if (active) setError('No se pudieron abrir los adjuntos de esta nota.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [blockSession, loadAttachments])

  useEffect(() => {
    if (!insertRequest || disabled || !enabled) return
    if (consumedInsertRef.current === insertRequest.token) return
    consumedInsertRef.current = insertRequest.token
    if (insertRequest.kind === 'image') imageInputRef.current?.click()
    else fileInputRef.current?.click()
  }, [disabled, enabled, insertRequest])

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

  async function store(file: File) {
    if (!onRequestAttachmentStore || busy) return
    setBusy(true)
    setError('')
    try {
      const stored = await onRequestAttachmentStore(file)
      setItems((current) => [...current, stored])
      if (isImage(stored) && blockSession) {
        const presentation = createReplicaAttachmentPresentation(stored.id)
        setPresentations((current) => ({ ...current, [stored.id]: presentation }))
        await blockSession.upsert(encodeReplicaAttachmentPresentation(presentation))
      }
      onActivity()
    } catch {
      setError('No se pudo guardar el adjunto de forma cifrada.')
    } finally {
      setBusy(false)
    }
  }

  async function replace(oldItem: EditorSurfaceAttachment, file: File) {
    if (!onRequestAttachmentStore || !onRequestAttachmentRemove || busy) return
    setBusy(true)
    setError('')
    try {
      const stored = await onRequestAttachmentStore(file)
      const removed = await onRequestAttachmentRemove(oldItem.id)
      const oldPresentation = presentations[oldItem.id]
      if (!removed) {
        setItems((current) => [...current, stored])
        if (isImage(stored) && blockSession) {
          const newPresentation = createReplicaAttachmentPresentation(stored.id)
          setPresentations((current) => ({ ...current, [stored.id]: newPresentation }))
          await blockSession.upsert(encodeReplicaAttachmentPresentation(newPresentation))
        }
        setError('La imagen nueva se guardó, pero la anterior no pudo eliminarse.')
      } else {
        setItems((current) => current.map((item) => item.id === oldItem.id ? stored : item))
        if (oldPresentation && blockSession) {
          const transferred = { ...oldPresentation, attachmentId: stored.id }
          await blockSession.upsert(encodeReplicaAttachmentPresentation(transferred))
          setPresentations((current) => {
            const next = { ...current }
            delete next[oldItem.id]
            next[stored.id] = transferred
            return next
          })
        } else if (isImage(stored) && blockSession) {
          const newPresentation = createReplicaAttachmentPresentation(stored.id)
          setPresentations((current) => ({ ...current, [stored.id]: newPresentation }))
          await blockSession.upsert(encodeReplicaAttachmentPresentation(newPresentation))
        }
      }
      setActiveMenuId(null)
      onActivity()
    } catch {
      setError('No se pudo reemplazar la imagen.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: EditorSurfaceAttachment) {
    if (!onRequestAttachmentRemove || busy) return
    if (!window.confirm(`¿Eliminar “${item.name}”?`)) return
    setBusy(true)
    setError('')
    try {
      if (!(await onRequestAttachmentRemove(item.id))) throw new Error('remove-failed')
      const presentation = presentations[item.id]
      if (presentation && blockSession) await blockSession.remove(presentation.id)
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
      setPresentations((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      setActiveMenuId(null)
      onActivity()
    } catch {
      setError('No se pudo eliminar el adjunto.')
    } finally {
      setBusy(false)
    }
  }

  async function openFile(item: EditorSurfaceAttachment) {
    if (!loadAttachmentFile || busy || item.remote) return
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

  if (!enabled && !loading) return null

  const images = items.filter(isImage)
  const files = items.filter((item) => !isImage(item))

  return <section className="oanix-replica-assets" aria-label="Imágenes y archivos de la nota" aria-busy={loading || busy}>
    {loading && <p className="oanix-replica-assets__status" role="status">Abriendo referencias de adjuntos…</p>}
    {error && <p className="oanix-replica-assets__error" role="alert">{error}</p>}
    {images.map((item) => <ImageCard
      key={item.id}
      item={item}
      presentation={presentationFor(item)}
      disabled={disabled || busy}
      active={activeMenuId === item.id}
      loadAttachmentFile={loadAttachmentFile!}
      onToggleMenu={() => setActiveMenuId((current) => current === item.id ? null : item.id)}
      onPresentationChange={queuePresentation}
      onReplace={replace}
      onRemove={remove}
      onError={setError}
    />)}
    {files.map((item) => <article key={item.id} className="oanix-replica-asset oanix-replica-asset--file" data-oanix-attachment-id={item.id}>
      <span className="oanix-replica-asset__file-icon" aria-hidden="true"><FileIcon /></span>
      <span className="oanix-replica-asset__file-copy"><strong>{item.name}</strong><small>{item.mimeType || 'Archivo'} · {humanBytes(item.byteLength)}{item.remote ? ' · remoto' : ''}</small></span>
      <button type="button" disabled={disabled || busy || item.remote} title={item.remote ? 'La recuperación por streaming se conectará en el siguiente bloque.' : undefined} onClick={() => void openFile(item)}>Abrir</button>
      <button type="button" className="is-danger" disabled={disabled || busy} onClick={() => void remove(item)}>Eliminar</button>
    </article>)}

    <input ref={imageInputRef} className="oanix-replica-asset__hidden-input" type="file" accept="image/*" tabIndex={-1} onChange={(event) => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) void store(file)
    }} />
    <input ref={fileInputRef} className="oanix-replica-asset__hidden-input" type="file" tabIndex={-1} onChange={(event) => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) void store(file)
    }} />
  </section>
}
