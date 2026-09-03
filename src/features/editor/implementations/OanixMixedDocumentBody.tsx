import { useEffect, useRef, useState } from 'react'
import type { EditorSurfaceAttachment, EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import { findOanixClipboardImage } from '../oanixClipboardImage.ts'
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
  onTextCursorChange: (blockId: string, cursorOffset: number) => void
  onPasteImage: (file: File, blockId: string, cursorOffset: number) => void | Promise<void>
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
  onCursorChange: (blockId: string, cursorOffset: number) => void
  onPasteImage: (file: File, blockId: string, cursorOffset: number) => void | Promise<void>
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
    if (!textarea) return
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
      const file = findOanixClipboardImage(event.clipboardData)
      if (!file || disabled) return
      event.preventDefault()
      const cursorOffset = Math.max(0, event.currentTarget.selectionStart ?? event.currentTarget.value.length)
      onCursorChange(block.id, cursorOffset)
      void onPasteImage(file, block.id, cursorOffset)
    }}
    onCompositionStart={onCompositionStart}
    onCompositionEnd={() => {
      onCompositionEnd()
      reportCursor()
    }}
  />
}

function OanixMixedImage({
  blockId,
  attachment,
  disabled,
  loadAttachmentFile,
  onRemove,
  onError,
}: {
  blockId: string
  attachment: EditorSurfaceAttachment | undefined
  disabled: boolean
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onRemove: () => void | Promise<void>
  onError?: (message: string) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const startedRef = useRef(false)
  const [requested, setRequested] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    if (!requested || !attachment || attachment.remote || url || startedRef.current) return
    let active = true
    startedRef.current = true
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
  }, [attachment, loadAttachmentFile, onError, requested, url])

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])

  const title = attachment?.name || 'Imagen cifrada'
  const meta = attachment ? `${attachment.mimeType || 'Imagen'} · ${formatBytes(attachment.byteLength)}` : 'Referencia conservada'
  const preview = <div ref={hostRef} className="oanix-mixed-document__image-preview">
    {url
      ? <img src={url} alt={title} loading="lazy" />
      : <div className="oanix-mixed-document__image-placeholder" data-loading={loading ? 'true' : 'false'}>
        <span aria-hidden="true">▧</span>
        <small>{attachment?.remote ? 'Imagen remota cifrada' : loading ? 'Descifrando imagen…' : attachment ? 'Imagen cifrada' : 'Adjunto no disponible'}</small>
      </div>}
  </div>

  return <OanixInsertableElementFrame
    elementId={blockId}
    kind="image"
    title={title}
    meta={meta}
    preview={preview}
    expanded={url ? <img className="oanix-mixed-document__expanded-image" src={url} alt={title} /> : preview}
    disabled={disabled}
    onRemove={onRemove}
  />
}

/**
 * Mixed renderer for continuous text interrupted by atomic OANIX elements.
 *
 * Text remains uncontrolled per segment so a keystroke does not mirror the whole
 * document into React state. Cursor updates are tiny metadata events used only to
 * preserve contextual insertion. Images are atomic flow children, never overlays,
 * and their bytes are loaded lazily only when the card approaches the viewport.
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
          blockId={node.block.id}
          attachment={attachmentMap.get(node.block.attachmentId)}
          disabled={disabled}
          loadAttachmentFile={loadAttachmentFile}
          onRemove={() => onRemoveImage(node.block.id, node.block.attachmentId)}
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
