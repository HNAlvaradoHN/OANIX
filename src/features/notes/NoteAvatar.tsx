import { useCallback, useEffect, useState, type MouseEvent, type PointerEvent } from 'react'
import { chooseNoteAvatar, loadNoteAvatarPreview } from './noteAvatarService'
import type { NoteRecord } from './noteTypes'

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

export function NoteAvatar({ note, className }: NoteAvatarProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)

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
    void loadNoteAvatarPreview(note.id)
      .then((blob) => {
        if (!active || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => {
        // Missing/corrupt avatar data never blocks access to the note.
        // The note initial remains the safe visual fallback.
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [note.id, revision])

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>) {
    event.stopPropagation()
  }

  function handleClick(event: MouseEvent<HTMLSpanElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (busy) return

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

  return (
    <span
      className={className}
      data-oanix-avatar-picker="true"
      title={busy ? 'Guardando avatar…' : 'Elegir foto de avatar'}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      style={{ cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.72 : undefined }}
    >
      {previewUrl
        ? <img src={previewUrl} alt="" draggable={false} />
        : noteInitial(note.title)}
    </span>
  )
}
