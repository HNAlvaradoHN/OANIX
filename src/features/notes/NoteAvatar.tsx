import { useEffect, useMemo, useState } from 'react'
import { loadEncryptedImagePreview } from '../images/imageService'
import type { ImageBlock, NoteRecord } from './noteTypes'

interface NoteAvatarProps {
  note: NoteRecord
  className: string
}

function noteInitial(title: string): string {
  const first = title.trim().charAt(0)
  return first ? first.toUpperCase() : 'N'
}

function firstImageBlock(note: NoteRecord): ImageBlock | null {
  return note.content.blocks.find((block): block is ImageBlock => block.type === 'image') ?? null
}

export function NoteAvatar({ note, className }: NoteAvatarProps) {
  const imageBlock = useMemo(() => firstImageBlock(note), [note.content.blocks])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    setPreviewUrl(null)
    if (!imageBlock) return () => { active = false }

    void loadEncryptedImagePreview(imageBlock.imageId, imageBlock.mimeType)
      .then((blob) => {
        if (!active || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => {
        // A missing/corrupt preview must never block access to the note.
        // The initial remains the safe visual fallback.
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageBlock?.imageId, imageBlock?.mimeType])

  return (
    <span className={className} aria-hidden="true">
      {previewUrl
        ? <img src={previewUrl} alt="" draggable={false} />
        : noteInitial(note.title)}
    </span>
  )
}
