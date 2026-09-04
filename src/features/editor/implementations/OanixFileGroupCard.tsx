import { useEffect, useRef, useState } from 'react'
import {
  attachmentIcon,
  attachmentTypeLabel,
  formatAttachmentSize,
} from '../../attachments/attachmentTypes.ts'
import type { EditorSurfaceAttachment } from '../editorSurfaceContract.ts'
import type { OanixFileGroupElement } from '../oanixFileGroupElementCodec.ts'
import './oanixFileGroupCard.css'

interface OanixFileGroupCardProps {
  block: OanixFileGroupElement
  attachments: readonly EditorSurfaceAttachment[]
  disabled: boolean
  loadAttachmentFile: (attachmentId: string) => Promise<File | null>
  onAddFiles: () => void
  onRemoveFile: (attachmentId: string) => void | Promise<void>
  onRemoveGroup: () => void | Promise<void>
  onError?: (message: string) => void
}

function canPreviewInBrowser(mimeType: string): boolean {
  return (
    mimeType === 'application/pdf'
    || mimeType.startsWith('image/')
    || mimeType.startsWith('text/')
    || mimeType.startsWith('audio/')
    || mimeType.startsWith('video/')
  )
}

export function OanixFileGroupCard({
  block,
  attachments,
  disabled,
  loadAttachmentFile,
  onAddFiles,
  onRemoveFile,
  onRemoveGroup,
  onError,
}: OanixFileGroupCardProps) {
  const hostRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('down')
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null)

  const attachmentMap = new Map(attachments.map((item) => [item.id, item]))
  const items = block.attachmentIds
    .map((attachmentId) => attachmentMap.get(attachmentId))
    .filter((item): item is EditorSurfaceAttachment => Boolean(item))
  const missingCount = block.attachmentIds.length - items.length
  const totalBytes = items.reduce((sum, item) => sum + item.byteLength, 0)

  function closeMenu() {
    setMenuOpen(false)
  }

  function openMenu() {
    if (disabled) return
    const host = hostRef.current
    if (host) {
      const bounds = host.getBoundingClientRect()
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const viewportTop = window.visualViewport?.offsetTop ?? 0
      const spaceBelow = viewportTop + viewportHeight - bounds.bottom
      const spaceAbove = bounds.top - viewportTop
      setMenuDirection(spaceBelow < 230 && spaceAbove > spaceBelow ? 'up' : 'down')
    }
    setMenuOpen(true)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (hostRef.current?.contains(target) || menuRef.current?.contains(target))) return
      closeMenu()
    }
    const onScroll = () => closeMenu()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKeyDown)
    window.visualViewport?.addEventListener('resize', onScroll)
    window.visualViewport?.addEventListener('scroll', onScroll)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKeyDown)
      window.visualViewport?.removeEventListener('resize', onScroll)
      window.visualViewport?.removeEventListener('scroll', onScroll)
    }
  }, [menuOpen])

  async function openAttachment(item: EditorSurfaceAttachment) {
    if (busyAttachmentId || disabled) return
    setBusyAttachmentId(item.id)
    try {
      const file = await loadAttachmentFile(item.id)
      if (!file) {
        onError?.('No se pudo abrir el archivo cifrado.')
        return
      }

      const objectUrl = URL.createObjectURL(file)
      if (canPreviewInBrowser(item.mimeType)) {
        const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
        if (opened) {
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
          return
        }
      }

      const link = document.createElement('a')
      link.href = objectUrl
      link.download = item.name
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch {
      onError?.('No se pudo abrir el archivo cifrado.')
    } finally {
      setBusyAttachmentId(null)
    }
  }

  async function removeSingleFile(item: EditorSurfaceAttachment) {
    if (disabled || busyAttachmentId) return
    if (!window.confirm(`¿Quitar “${item.name}” de esta tarjeta?`)) return
    await onRemoveFile(item.id)
  }

  async function removeWholeGroup() {
    closeMenu()
    if (disabled) return
    const label = items.length === 1 ? '1 archivo' : `${items.length} archivos`
    if (!window.confirm(`¿Eliminar esta tarjeta y sus ${label}?`)) return
    await onRemoveGroup()
  }

  return <article
    ref={hostRef}
    className="oanix-file-group"
    data-oanix-element-id={block.id}
    data-oanix-element-kind="file-group"
    onClick={(event) => {
      if (disabled) return
      const target = event.target as HTMLElement | null
      if (target?.closest('button, a')) return
      menuOpen ? closeMenu() : openMenu()
    }}
  >
    <header className="oanix-file-group__header">
      <span className="oanix-file-group__hero" aria-hidden="true">📎</span>
      <div>
        <strong>Archivos</strong>
        <small>{items.length === 0 ? 'Tarjeta vacía' : `${items.length} ${items.length === 1 ? 'archivo' : 'archivos'} · ${formatAttachmentSize(totalBytes)}`}</small>
      </div>
      <span className="oanix-file-group__hint">Toca para opciones</span>
    </header>

    <div className="oanix-file-group__list">
      {items.map((item) => <div className="oanix-file-group__row" key={item.id}>
        <span className="oanix-file-group__type-icon" aria-hidden="true">{attachmentIcon({ name: item.name, mimeType: item.mimeType })}</span>
        <div className="oanix-file-group__file-info">
          <strong title={item.name}>{item.name}</strong>
          <small>{attachmentTypeLabel({ name: item.name, mimeType: item.mimeType })} · {formatAttachmentSize(item.byteLength)}</small>
        </div>
        <div className="oanix-file-group__row-actions">
          <button
            type="button"
            aria-label={`Abrir o guardar ${item.name}`}
            title="Abrir o guardar"
            disabled={disabled || busyAttachmentId !== null}
            onClick={() => void openAttachment(item)}
          >{busyAttachmentId === item.id ? '…' : '↗'}</button>
          <button
            type="button"
            className="is-danger"
            aria-label={`Quitar ${item.name}`}
            title="Quitar archivo"
            disabled={disabled || busyAttachmentId !== null}
            onClick={() => void removeSingleFile(item)}
          >×</button>
        </div>
      </div>)}

      {items.length === 0 && <button type="button" className="oanix-file-group__empty" disabled={disabled} onClick={onAddFiles}>
        <span aria-hidden="true">＋</span>
        <strong>Añadir archivos</strong>
        <small>Puedes guardar varios dentro de esta tarjeta.</small>
      </button>}

      {missingCount > 0 && <div className="oanix-file-group__missing" role="status">
        {missingCount} {missingCount === 1 ? 'archivo no disponible' : 'archivos no disponibles'}
      </div>}
    </div>

    {menuOpen && <div
      ref={menuRef}
      className="oanix-file-group__menu"
      data-direction={menuDirection}
      role="menu"
      aria-label="Opciones de tarjeta de archivos"
    >
      <button type="button" role="menuitem" disabled={disabled} onClick={() => { closeMenu(); onAddFiles() }}>＋ <span>Añadir archivos</span></button>
      <button type="button" role="menuitem" className="is-danger" disabled={disabled} onClick={() => void removeWholeGroup()}>⌫ <span>Eliminar tarjeta</span></button>
    </div>}
  </article>
}
