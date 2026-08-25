import { useCallback, useEffect, useState } from 'react'
import {
  loadNoteAvatarPreview,
  readNoteAvatar,
} from './noteAvatarService'
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

export function NoteAvatar({ note, className }: NoteAvatarProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

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
        if (!active || !avatar) return

        const blob = await loadNoteAvatarPreview(note.id)
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

  return (
    <span
      className={className}
      title="Mantén pulsado para reordenar"
    >
      {previewUrl
        ? <img src={previewUrl} alt="" draggable={false} />
        : noteInitial(note.title)}
    </span>
  )
}
