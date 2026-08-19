import { useCallback, useEffect, useState, type MouseEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  chooseNoteAvatar,
  deleteNoteAvatar,
  loadNoteAvatarImage,
  loadNoteAvatarPreview,
  readNoteAvatar,
} from './noteAvatarService'
import type { NoteRecord } from './noteTypes'
import './noteAvatarActions.css'

interface NoteAvatarProps {
  note: NoteRecord
  className: string
}

interface AvatarChangedDetail {
  noteId?: string
}

interface SyncStatusDetail {
  kind?: string
}

interface AvatarMenuPosition {
  left: number
  top: number
}

function noteInitial(title: string): string {
  const first = title.trim().charAt(0)
  return first ? first.toUpperCase() : 'N'
}

function openImagePicker(onFile: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp,image/gif'
  input.tabIndex = -1
  input.style.position = 'fixed'
  input.style.width = '1px'
  input.style.height = '1px'
  input.style.opacity = '0'
  input.style.pointerEvents = 'none'
  input.style.left = '-10000px'

  const cleanup = () => input.remove()
  input.addEventListener('change', () => {
    const file = input.files?.[0] ?? null
    cleanup()
    if (file) onFile(file)
  }, { once: true })
  input.addEventListener('cancel', cleanup, { once: true })

  document.body.appendChild(input)
  input.click()
}

function menuPositionFor(target: HTMLElement): AvatarMenuPosition {
  const rect = target.getBoundingClientRect()
  const margin = 8
  const width = 168
  const height = 142
  const maxLeft = Math.max(margin, window.innerWidth - width - margin)
  const left = Math.min(Math.max(margin, rect.left), maxLeft)
  const below = rect.bottom + 6
  const top = below + height <= window.innerHeight - margin
    ? below
    : Math.max(margin, rect.top - height - 6)

  return { left, top }
}

export function NoteAvatar({ note, className }: NoteAvatarProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [hasAvatar, setHasAvatar] = useState(false)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [menuPosition, setMenuPosition] = useState<AvatarMenuPosition | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    const handleAvatarChanged = (event: Event) => {
      const detail = (event as CustomEvent<AvatarChangedDetail>).detail
      if (detail?.noteId === note.id) refresh()
    }
    const handleSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatusDetail>).detail
      if (detail?.kind === 'synced' || detail?.kind === 'conflict') refresh()
    }

    window.addEventListener('oanix:note-avatar-changed', handleAvatarChanged)
    window.addEventListener('oanix:sync-status', handleSyncStatus)
    return () => {
      window.removeEventListener('oanix:note-avatar-changed', handleAvatarChanged)
      window.removeEventListener('oanix:sync-status', handleSyncStatus)
    }
  }, [note.id, refresh])

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    setPreviewUrl(null)
    void readNoteAvatar(note.id)
      .then(async (avatar) => {
        if (!active) return
        setHasAvatar(Boolean(avatar))
        if (!avatar) return

        const blob = await loadNoteAvatarPreview(note.id)
        if (!active || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => {
        if (active) setHasAvatar(false)
        // Missing/corrupt avatar data never blocks access to the note.
        // The note initial remains the safe visual fallback.
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [note.id, revision])

  useEffect(() => {
    if (!viewerUrl) return
    return () => URL.revokeObjectURL(viewerUrl)
  }, [viewerUrl])

  useEffect(() => {
    if (!menuPosition) return

    const close = () => setMenuPosition(null)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('pointerdown', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuPosition])

  function selectAvatarFile() {
    setMenuPosition(null)
    openImagePicker((file) => {
      setBusy(true)
      void chooseNoteAvatar(note.id, file)
        .then(() => refresh())
        .catch((error) => {
          window.alert(error instanceof Error ? error.message : 'No se pudo cambiar el avatar de esta nota.')
        })
        .finally(() => setBusy(false))
    })
  }

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>) {
    event.stopPropagation()
  }

  function handleClick(event: MouseEvent<HTMLSpanElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (busy) return

    if (!hasAvatar) {
      selectAvatarFile()
      return
    }

    const nextPosition = menuPositionFor(event.currentTarget)
    setMenuPosition((current) => current ? null : nextPosition)
  }

  function handleView() {
    setMenuPosition(null)
    setBusy(true)
    void loadNoteAvatarImage(note.id)
      .then((blob) => {
        if (!blob) throw new Error('La imagen del avatar ya no está disponible.')
        setViewerUrl(URL.createObjectURL(blob))
      })
      .catch((error) => {
        window.alert(error instanceof Error ? error.message : 'No se pudo abrir el avatar.')
      })
      .finally(() => setBusy(false))
  }

  function handleDelete() {
    setMenuPosition(null)
    if (!window.confirm('¿Eliminar la foto del avatar de esta nota?')) return

    setBusy(true)
    void deleteNoteAvatar(note.id)
      .then(() => {
        setHasAvatar(false)
        refresh()
      })
      .catch((error) => {
        window.alert(error instanceof Error ? error.message : 'No se pudo eliminar el avatar.')
      })
      .finally(() => setBusy(false))
  }

  const menu = menuPosition && hasAvatar
    ? createPortal(
        <div
          className="oanix-avatar-menu"
          role="menu"
          aria-label={`Avatar de ${note.title}`}
          style={{ left: menuPosition.left, top: menuPosition.top }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={handleView}>Ver</button>
          <button type="button" role="menuitem" onClick={selectAvatarFile}>Cambiar</button>
          <button type="button" role="menuitem" className="oanix-avatar-menu__danger" onClick={handleDelete}>Eliminar</button>
        </div>,
        document.body,
      )
    : null

  const viewer = viewerUrl
    ? createPortal(
        <div
          className="oanix-avatar-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`Avatar de ${note.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            if (event.target === event.currentTarget) setViewerUrl(null)
          }}
        >
          <div className="oanix-avatar-viewer__panel">
            <button
              className="oanix-avatar-viewer__close"
              type="button"
              aria-label="Cerrar imagen"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setViewerUrl(null)
              }}
            >
              ×
            </button>
            <img src={viewerUrl} alt={`Avatar de ${note.title}`} draggable={false} />
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <span
        className={className}
        data-oanix-avatar-picker="true"
        data-oanix-avatar-present={hasAvatar ? 'true' : 'false'}
        title={busy ? 'Procesando avatar…' : hasAvatar ? 'Opciones del avatar' : 'Elegir foto de avatar'}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        style={{ cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.72 : undefined }}
      >
        {previewUrl
          ? <img src={previewUrl} alt="" draggable={false} />
          : noteInitial(note.title)}
      </span>
      {menu}
      {viewer}
    </>
  )
}
