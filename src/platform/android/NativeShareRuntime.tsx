import { useEffect, useRef, useState } from 'react'
import type { NoteRecord } from '../../features/notes/noteTypes'
import { importPendingAndroidShare, isAndroidNativeShareRuntime } from './nativeShare'

interface NativeShareRuntimeProps {
  onImported: (note: NoteRecord) => void
}

const OPEN_IMPORTED_NOTE_TIMEOUT_MS = 5000
const OPEN_IMPORTED_NOTE_RETRY_MS = 50

function findImportedNoteButton(noteId: string): HTMLButtonElement | null {
  const rows = document.querySelectorAll<HTMLElement>('[data-reorder-note-id]')
  for (const row of rows) {
    if (row.dataset.reorderNoteId !== noteId) continue
    return row.querySelector<HTMLButtonElement>('.note-row__open')
  }
  return null
}

function prioritizeEncryptedImagePreviews(): void {
  document
    .querySelectorAll<HTMLImageElement>('.image-note-editor-root img[data-image-element="true"]')
    .forEach((image) => {
      // These previews are already decrypted from local encrypted storage before a src is assigned.
      // Lazy loading only delays rendering inside Android WebView and can leave a broken/alt-text
      // placeholder until the user touches the editor.
      image.loading = 'eager'

      if (
        image.dataset.oanixPreviewRetried !== 'true'
        && image.complete
        && image.naturalWidth === 0
        && image.src.startsWith('blob:')
      ) {
        image.dataset.oanixPreviewRetried = 'true'
        const source = image.src
        image.removeAttribute('src')
        window.requestAnimationFrame(() => {
          if (image.isConnected && !image.getAttribute('src')) image.src = source
        })
      }
    })
}

export function NativeShareRuntime({ onImported }: NativeShareRuntimeProps) {
  const attemptedRef = useRef(false)
  const onImportedRef = useRef(onImported)
  const openTimerRef = useRef<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    onImportedRef.current = onImported
  }, [onImported])

  useEffect(() => {
    if (!isAndroidNativeShareRuntime()) return

    prioritizeEncryptedImagePreviews()
    const observer = new MutationObserver(prioritizeEncryptedImagePreviews)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isAndroidNativeShareRuntime() || attemptedRef.current) return
    attemptedRef.current = true
    let active = true
    let messageTimer: number | null = null

    function openImportedNoteWhenReady(noteId: string) {
      const deadline = Date.now() + OPEN_IMPORTED_NOTE_TIMEOUT_MS

      const attempt = () => {
        if (!active) return
        const button = findImportedNoteButton(noteId)
        if (button) {
          button.click()
          prioritizeEncryptedImagePreviews()
          return
        }

        if (Date.now() < deadline) {
          openTimerRef.current = window.setTimeout(attempt, OPEN_IMPORTED_NOTE_RETRY_MS)
        }
      }

      attempt()
    }

    void importPendingAndroidShare()
      .then((note) => {
        if (!active || !note) return
        onImportedRef.current(note)
        openImportedNoteWhenReady(note.id)
        setMessage('Contenido compartido guardado en una nota nueva y cifrada.')
        messageTimer = window.setTimeout(() => setMessage(''), 3200)
      })
      .catch((shareError) => {
        if (!active) return
        setError(
          shareError instanceof Error
            ? shareError.message
            : 'No se pudo importar el contenido compartido en OANIX.',
        )
      })

    return () => {
      active = false
      if (messageTimer !== null) window.clearTimeout(messageTimer)
      if (openTimerRef.current !== null) {
        window.clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
    }
  }, [])

  if (!isAndroidNativeShareRuntime() || (!message && !error)) return null

  return (
    <aside
      role={error ? 'alert' : 'status'}
      aria-live="polite"
      style={{
        position: 'fixed',
        zIndex: 2850,
        left: '50%',
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        width: 'min(34rem, calc(100vw - 1rem))',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '.75rem',
        padding: '.78rem .9rem',
        border: '1px solid rgba(148,163,184,.28)',
        borderRadius: '.9rem',
        background: 'rgba(15,23,42,.97)',
        color: '#eef5ff',
        boxShadow: '0 16px 45px rgba(0,0,0,.3)',
      }}
    >
      <span>{error || message}</span>
      {error && (
        <button
          type="button"
          onClick={() => setError('')}
          aria-label="Cerrar error de contenido compartido"
          style={{
            minWidth: '2.25rem',
            minHeight: '2.25rem',
            border: 0,
            borderRadius: '.6rem',
            background: 'rgba(255,255,255,.08)',
            color: 'inherit',
          }}
        >×</button>
      )}
    </aside>
  )
}
