import { useEffect, useRef, useState } from 'react'
import type { EditorSurfaceAttachment } from '../editorSurfaceContract'
import './replicaV16Attachments.css'

export type ReplicaAttachmentInsertKind = 'image' | 'file'

export interface ReplicaAttachmentInsertRequest {
  token: number
  kind: ReplicaAttachmentInsertKind
}

interface ReplicaV16AttachmentsProps {
  disabled: boolean
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
  disabled: boolean
  active: boolean
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onToggleMenu: () => void
  onReplace: (oldItem: EditorSurfaceAttachment, file: File) => Promise<void>
  onRemove: (item: EditorSurfaceAttachment) => Promise<void>
  onError: (message: string) => void
}

function ImageCard({ item, disabled, active, loadAttachmentFile, onToggleMenu, onReplace, onRemove, onError }: ImageCardProps) {
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

  return <article ref={hostRef} className="oanix-replica-asset oanix-replica-asset--image" data-oanix-attachment-id={item.id}>
    <button type="button" className="oanix-replica-asset__more" aria-label={`Opciones de ${item.name}`} aria-expanded={active} disabled={disabled} onClick={onToggleMenu}><MoreIcon /></button>
    <div className="oanix-replica-asset__image-stage">
      {url ? <img src={url} alt={item.name} loading="lazy" /> : <div className="oanix-replica-asset__placeholder"><ImageIcon /><span>{item.remote ? 'Imagen remota cifrada' : loading ? 'Descifrando imagen…' : 'Imagen cifrada'}</span></div>}
    </div>
    <div className="oanix-replica-asset__caption"><strong>{item.name}</strong><span>{humanBytes(item.byteLength)}{item.remote ? ' · remoto' : ''}</span></div>
    {active && <div className="oanix-replica-asset__menu" role="menu" aria-label={`Opciones de imagen ${item.name}`}>
      <button type="button" role="menuitem" disabled={!url} onClick={() => { if (url) window.open(url, '_blank', 'noopener,noreferrer') }}>Abrir</button>
      <button type="button" role="menuitem" disabled={disabled} onClick={() => replaceRef.current?.click()}>Reemplazar</button>
      <button type="button" role="menuitem" onClick={() => window.alert(`${item.name}\n${item.mimeType || 'tipo desconocido'}\n${humanBytes(item.byteLength)}${item.remote ? '\nAdjunto remoto cifrado' : '\nAdjunto local cifrado'}`)}>Información</button>
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
  const [loading, setLoading] = useState(Boolean(loadAttachments))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const enabled = Boolean(loadAttachments && onRequestAttachmentStore && loadAttachmentFile && onRequestAttachmentRemove)

  useEffect(() => {
    if (!loadAttachments) return
    let active = true
    setLoading(true)
    void loadAttachments().then((loaded) => {
      if (!active) return
      setItems(loaded)
      setError('')
    }).catch(() => {
      if (active) setError('No se pudieron abrir los adjuntos de esta nota.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [loadAttachments])

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

  async function store(file: File) {
    if (!onRequestAttachmentStore || busy) return
    setBusy(true)
    setError('')
    try {
      const stored = await onRequestAttachmentStore(file)
      setItems((current) => [...current, stored])
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
      if (!removed) {
        setItems((current) => [...current, stored])
        setError('La imagen nueva se guardó, pero la anterior no pudo eliminarse.')
      } else {
        setItems((current) => current.map((item) => item.id === oldItem.id ? stored : item))
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
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
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
      disabled={disabled || busy}
      active={activeMenuId === item.id}
      loadAttachmentFile={loadAttachmentFile!}
      onToggleMenu={() => setActiveMenuId((current) => current === item.id ? null : item.id)}
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
