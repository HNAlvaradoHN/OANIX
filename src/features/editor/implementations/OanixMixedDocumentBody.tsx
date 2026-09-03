import { useEffect, useRef, useState } from 'react'
import type { EditorSurfaceAttachment, EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import { findOanixClipboardImage } from '../oanixClipboardImage.ts'
import {
  encodeOanixImageElement,
  type OanixImageElement,
} from '../oanixImageElementCodec.ts'
import type { OanixLongTextElement } from '../oanixLongTextElementCodec.ts'
import { encodeTextBlock, type EditorTextBlock } from '../textBlockCodec.ts'
import { projectOanixMixedDocument } from '../oanixMixedDocumentProjection.ts'
import { OanixInsertableElementFrame } from './OanixInsertableElementFrame.tsx'
import './oanixMixedDocumentBody.css'

interface OanixMixedDocumentBodyProps {
  blocks: readonly EditorSurfaceBlock[]
  attachments: readonly EditorSurfaceAttachment[]
  disabled: boolean
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onTextBlockChange: (block: EditorSurfaceBlock) => void | Promise<void>
  onTextCursorChange?: (blockId: string, cursorOffset: number) => void
  onPasteImage?: (file: File, blockId: string, cursorOffset: number) => void | Promise<void>
  onRemoveImage: (blockId: string, attachmentId: string) => void | Promise<void>
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onError?: (message: string) => void
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function OanixMixedTextSegment({
  block,
  disabled,
  onChange,
  onCursorChange,
  onPasteImage,
  onActivity,
  onCompositionStart,
  onCompositionEnd,
}: {
  block: EditorTextBlock
  disabled: boolean
  onChange: (block: EditorSurfaceBlock) => void | Promise<void>
  onCursorChange?: (blockId: string, cursorOffset: number) => void
  onPasteImage?: (file: File, blockId: string, cursorOffset: number) => void | Promise<void>
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  function resize() {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(56, textarea.scrollHeight)}px`
  }

  function reportCursor() {
    const textarea = textareaRef.current
    if (!textarea || !onCursorChange) return
    onCursorChange(block.id, Math.max(0, textarea.selectionStart ?? textarea.value.length))
  }

  useEffect(() => resize(), [])

  return <textarea
    ref={textareaRef}
    className="oanix-mixed-document__text"
    data-oanix-mixed-text-id={block.id}
    defaultValue={block.text}
    readOnly={disabled}
    spellCheck
    autoComplete="off"
    autoCapitalize="sentences"
    aria-label="Tramo de texto de la nota"
    onInput={(event) => {
      resize()
      onActivity()
      reportCursor()
      void onChange(encodeTextBlock({ ...block, text: event.currentTarget.value }))
    }}
    onSelect={reportCursor}
    onKeyUp={reportCursor}
    onPointerUp={reportCursor}
    onPaste={(event) => {
      if (!onPasteImage || disabled) return
      const file = findOanixClipboardImage(event.clipboardData)
      if (!file) return
      event.preventDefault()
      const cursorOffset = Math.max(0, event.currentTarget.selectionStart ?? event.currentTarget.value.length)
      onCursorChange?.(block.id, cursorOffset)
      void onPasteImage(file, block.id, cursorOffset)
    }}
    onCompositionStart={onCompositionStart}
    onCompositionEnd={() => {
      onCompositionEnd()
      reportCursor()
    }}
  />
}

function OanixImageViewer({
  url,
  title,
  onClose,
}: {
  url: string
  title: string
  onClose: () => void
}) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const gestureRef = useRef<{
    distance: number
    scale: number
    centerX: number
    centerY: number
    offsetX: number
    offsetY: number
  } | null>(null)

  function clampScale(value: number) {
    return Math.min(6, Math.max(1, value))
  }

  function resetView() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === '0') resetView()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return <div
    className="oanix-image-viewer"
    role="dialog"
    aria-modal="true"
    aria-label={`Imagen completa: ${title}`}
    onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}
  >
    <div
      className="oanix-image-viewer__stage"
      onWheel={(event) => {
        event.preventDefault()
        const next = clampScale(scale * (event.deltaY < 0 ? 1.16 : 0.86))
        setScale(next)
        if (next === 1) setOffset({ x: 0, y: 0 })
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        const points = [...pointersRef.current.values()]
        if (points.length === 1) {
          gestureRef.current = {
            distance: 0,
            scale,
            centerX: points[0].x,
            centerY: points[0].y,
            offsetX: offset.x,
            offsetY: offset.y,
          }
        } else if (points.length === 2) {
          const [a, b] = points
          gestureRef.current = {
            distance: Math.hypot(b.x - a.x, b.y - a.y),
            scale,
            centerX: (a.x + b.x) / 2,
            centerY: (a.y + b.y) / 2,
            offsetX: offset.x,
            offsetY: offset.y,
          }
        }
      }}
      onPointerMove={(event) => {
        if (!pointersRef.current.has(event.pointerId)) return
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        const points = [...pointersRef.current.values()]
        const gesture = gestureRef.current
        if (!gesture) return
        if (points.length >= 2) {
          const [a, b] = points
          const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
          const nextScale = clampScale(gesture.scale * (distance / Math.max(1, gesture.distance)))
          const centerX = (a.x + b.x) / 2
          const centerY = (a.y + b.y) / 2
          setScale(nextScale)
          setOffset({
            x: gesture.offsetX + centerX - gesture.centerX,
            y: gesture.offsetY + centerY - gesture.centerY,
          })
        } else if (points.length === 1 && scale > 1) {
          setOffset({
            x: gesture.offsetX + points[0].x - gesture.centerX,
            y: gesture.offsetY + points[0].y - gesture.centerY,
          })
        }
      }}
      onPointerUp={(event) => {
        pointersRef.current.delete(event.pointerId)
        gestureRef.current = null
      }}
      onPointerCancel={(event) => {
        pointersRef.current.delete(event.pointerId)
        gestureRef.current = null
      }}
      onDoubleClick={() => {
        if (scale > 1) resetView()
        else setScale(2)
      }}
    >
      <img
        src={url}
        alt={title}
        draggable={false}
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
      />
    </div>
    <div className="oanix-image-viewer__toolbar">
      <button type="button" onClick={() => setScale((current) => clampScale(current - 0.5))} aria-label="Alejar">−</button>
      <span>{Math.round(scale * 100)}%</span>
      <button type="button" onClick={() => setScale((current) => clampScale(current + 0.5))} aria-label="Acercar">+</button>
      <button type="button" onClick={resetView}>Restablecer</button>
    </div>
    <button type="button" className="oanix-image-viewer__close" aria-label="Cerrar imagen" onClick={onClose}>×</button>
  </div>
}

function OanixMixedImage({
  block,
  attachment,
  disabled,
  loadAttachmentFile,
  onChange,
  onRemove,
  onActivity,
  onError,
}: {
  block: OanixImageElement
  attachment: EditorSurfaceAttachment | undefined
  disabled: boolean
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onChange: (block: EditorSurfaceBlock) => void | Promise<void>
  onRemove: () => void | Promise<void>
  onActivity: () => void
  onError?: (message: string) => void
}) {
  const hostRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [requested, setRequested] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('down')
  const [viewerOpen, setViewerOpen] = useState(false)
  const [widthPercent, setWidthPercent] = useState(block.widthPercent)
  const [sizeLocked, setSizeLocked] = useState(block.sizeLocked)

  const title = attachment?.name || 'Imagen cifrada'

  useEffect(() => {
    setWidthPercent(block.widthPercent)
    setSizeLocked(block.sizeLocked)
  }, [block.sizeLocked, block.widthPercent])

  useEffect(() => {
    const host = hostRef.current
    if (!host || requested || !attachment || attachment.remote) return
    if (!('IntersectionObserver' in window)) {
      setRequested(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setRequested(true)
      observer.disconnect()
    }, { rootMargin: '320px 0px' })
    observer.observe(host)
    return () => observer.disconnect()
  }, [attachment, requested])

  useEffect(() => {
    if (!requested || !attachment || attachment.remote || url) return
    let active = true
    setLoading(true)
    void loadAttachmentFile(attachment.id).then((file) => {
      if (!active) return
      if (!file) {
        onError?.('No se pudo abrir la imagen cifrada.')
        return
      }
      setUrl(URL.createObjectURL(file))
    }).catch(() => {
      if (active) onError?.('No se pudo abrir la imagen cifrada.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [attachment, loadAttachmentFile, loadAttempt, onError, requested, url])

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])

  function persistPresentation(nextWidth: number, nextLocked: boolean) {
    setWidthPercent(nextWidth)
    setSizeLocked(nextLocked)
    onActivity()
    void onChange(encodeOanixImageElement({
      ...block,
      widthPercent: nextWidth,
      sizeLocked: nextLocked,
    }))
  }

  function lockResizeAndClose() {
    if (!sizeLocked) {
      persistPresentation(widthPercent, true)
    }
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!menuOpen && sizeLocked) return
    const close = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (hostRef.current?.contains(target) || menuRef.current?.contains(target))) return
      lockResizeAndClose()
    }
    const onScroll = () => setMenuOpen(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') lockResizeAndClose()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKey)
    window.visualViewport?.addEventListener('resize', onScroll)
    window.visualViewport?.addEventListener('scroll', onScroll)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey)
      window.visualViewport?.removeEventListener('resize', onScroll)
      window.visualViewport?.removeEventListener('scroll', onScroll)
    }
  }, [menuOpen, sizeLocked, widthPercent])

  function openMenu() {
    if (disabled) return
    const host = hostRef.current
    if (host) {
      const bounds = host.getBoundingClientRect()
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const viewportTop = window.visualViewport?.offsetTop ?? 0
      const spaceBelow = viewportTop + viewportHeight - bounds.bottom
      const spaceAbove = bounds.top - viewportTop
      setMenuDirection(spaceBelow < 250 && spaceAbove > spaceBelow ? 'up' : 'down')
    }
    setMenuOpen(true)
  }

  async function removeImage() {
    setMenuOpen(false)
    if (!window.confirm('¿Eliminar esta imagen de la nota?')) return
    await onRemove()
  }

  const showResize = !sizeLocked && Boolean(url)

  return <>
    <figure
      ref={hostRef}
      className="oanix-mixed-image"
      data-oanix-element-id={block.id}
      data-oanix-element-kind="image"
      style={{ width: `${widthPercent}%` }}
    >
      {url ? <img className="oanix-mixed-image__img" src={url} alt={title} loading="lazy" /> : (
        <button
          type="button"
          className="oanix-mixed-image__placeholder"
          data-loading={loading ? 'true' : 'false'}
          disabled={loading || !attachment || attachment.remote}
          onClick={() => {
            if (!loading && attachment && !attachment.remote) setLoadAttempt((value) => value + 1)
          }}
        >
          <span aria-hidden="true">▧</span>
          <small>{attachment?.remote ? 'Imagen remota cifrada' : loading ? 'Descifrando imagen…' : attachment ? 'Tocar para cargar imagen' : 'Adjunto no disponible'}</small>
        </button>
      )}

      {url && !disabled && <button
        type="button"
        className="oanix-mixed-image__menu-button"
        aria-label="Opciones de imagen"
        aria-expanded={menuOpen}
        onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
      >•••</button>}

      {showResize && <div className="oanix-mixed-image__resize-control">
        <span aria-hidden="true">↔</span>
        <input
          type="range"
          min="24"
          max="100"
          step="1"
          value={widthPercent}
          aria-label="Tamaño de imagen"
          onInput={(event) => persistPresentation(Number(event.currentTarget.value), false)}
        />
        <output>{widthPercent}%</output>
      </div>}

      {menuOpen && <div
        ref={menuRef}
        className="oanix-mixed-image__menu"
        data-direction={menuDirection}
        role="menu"
        aria-label="Opciones de imagen"
      >
        <button type="button" role="menuitem" aria-label={sizeLocked ? 'Desbloquear tamaño' : 'Bloquear tamaño'} onClick={() => {
          if (sizeLocked) {
            persistPresentation(widthPercent, false)
            return
          }
          lockResizeAndClose()
        }}>{sizeLocked ? '🔒' : '🔓'} <span>{sizeLocked ? 'Desbloquear tamaño' : 'Bloquear tamaño'}</span></button>
        <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setViewerOpen(true) }}>⛶ <span>Pantalla completa</span></button>
        <button type="button" role="menuitem" className="is-danger" onClick={() => void removeImage()}>⌫ <span>Eliminar</span></button>
      </div>}
    </figure>

    {viewerOpen && url && <OanixImageViewer url={url} title={title} onClose={() => setViewerOpen(false)} />}
  </>
}

function OanixLongTextExpanded({
  attachmentId,
  loadAttachmentFile,
  onError,
}: {
  attachmentId: string
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onError?: (message: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setLoading(true)
    void loadAttachmentFile(attachmentId).then((file) => {
      if (!active) return
      if (!file) {
        onError?.('No se pudo abrir el texto largo cifrado.')
        return
      }
      objectUrl = URL.createObjectURL(file)
      setUrl(objectUrl)
    }).catch(() => {
      if (active) onError?.('No se pudo abrir el texto largo cifrado.')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachmentId, loadAttachmentFile, onError])

  if (loading) return <div className="oanix-mixed-document__long-text-state" role="status">Abriendo texto cifrado…</div>
  if (!url) return <div className="oanix-mixed-document__long-text-state">Texto no disponible.</div>

  return <iframe
    className="oanix-mixed-document__long-text-viewer"
    src={url}
    title="Texto largo completo"
    sandbox=""
  />
}

function OanixMixedLongText({
  block,
  attachment,
  disabled,
  loadAttachmentFile,
  onError,
}: {
  block: OanixLongTextElement
  attachment: EditorSurfaceAttachment | undefined
  disabled: boolean
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onError?: (message: string) => void
}) {
  const title = attachment?.name || 'Texto largo'
  const lengthLabel = `${block.utf16Length.toLocaleString()} caracteres`
  const lineLabel = block.lines === null ? '' : ` · ${block.lines.toLocaleString()} líneas`
  const sizeLabel = attachment ? ` · ${formatBytes(attachment.byteLength)}` : ''

  return <OanixInsertableElementFrame
    elementId={block.id}
    kind="text"
    title={title}
    meta={`${lengthLabel}${lineLabel}${sizeLabel}`}
    preview={<pre className="oanix-mixed-document__long-text-preview">{block.preview}</pre>}
    expanded={<OanixLongTextExpanded attachmentId={block.attachmentId} loadAttachmentFile={loadAttachmentFile} onError={onError} />}
    disabled={disabled}
  />
}

/**
 * Mixed renderer for continuous text interrupted by atomic OANIX elements.
 * Text stays uncontrolled per segment. Images remain inline visual elements with
 * encrypted bytes loaded lazily; only compact presentation metadata is staged.
 */
export function OanixMixedDocumentBody({
  blocks,
  attachments,
  disabled,
  loadAttachmentFile,
  onTextBlockChange,
  onTextCursorChange,
  onPasteImage,
  onRemoveImage,
  onActivity,
  onCompositionStart,
  onCompositionEnd,
  onError,
}: OanixMixedDocumentBodyProps) {
  const attachmentMap = new Map(attachments.map((item) => [item.id, item]))
  const nodes = projectOanixMixedDocument(blocks)

  return <div className="oanix-mixed-document" data-oanix-mixed-document="true">
    {nodes.map((node) => {
      if (node.type === 'text') {
        return <OanixMixedTextSegment
          key={node.block.id}
          block={node.block}
          disabled={disabled}
          onChange={onTextBlockChange}
          onCursorChange={onTextCursorChange}
          onPasteImage={onPasteImage}
          onActivity={onActivity}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
        />
      }

      if (node.type === 'image') {
        return <OanixMixedImage
          key={node.block.id}
          block={node.block}
          attachment={attachmentMap.get(node.block.attachmentId)}
          disabled={disabled}
          loadAttachmentFile={loadAttachmentFile}
          onChange={onTextBlockChange}
          onRemove={() => onRemoveImage(node.block.id, node.block.attachmentId)}
          onActivity={onActivity}
          onError={onError}
        />
      }

      if (node.type === 'long-text') {
        return <OanixMixedLongText
          key={node.block.id}
          block={node.block}
          attachment={attachmentMap.get(node.block.attachmentId)}
          disabled={disabled}
          loadAttachmentFile={loadAttachmentFile}
          onError={onError}
        />
      }

      return <div key={node.block.id} className="oanix-mixed-document__unsupported" data-oanix-unsupported-kind={node.block.kind}>
        <strong>Elemento no disponible</strong>
        <small>La referencia se conserva sin modificarla.</small>
      </div>
    })}
  </div>
}