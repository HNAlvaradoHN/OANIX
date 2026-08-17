import { useEffect, useRef, useState } from 'react'
import type { NoteRecord } from '../../features/notes/noteTypes'
import {
  addAndroidShareReceivedListener,
  importPendingAndroidShare,
  isAndroidNativeShareRuntime,
  type AndroidShareImportProgress,
} from './nativeShare'

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
  const onImportedRef = useRef(onImported)
  const openTimerRef = useRef<number | null>(null)
  const [progress, setProgress] = useState<AndroidShareImportProgress | null>(null)
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
    if (!isAndroidNativeShareRuntime()) return

    let active = true
    let processing = false
    let rerunRequested = false
    let listenerHandle: { remove(): Promise<void> } | null = null
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

    async function processPendingShares() {
      if (!active) return
      if (processing) {
        rerunRequested = true
        return
      }

      processing = true
      try {
        do {
          rerunRequested = false
          setError('')

          let note: NoteRecord | null = null
          try {
            note = await importPendingAndroidShare((nextProgress) => {
              if (active) setProgress(nextProgress)
            })
          } catch (shareError) {
            if (!active) return
            setProgress(null)
            setError(
              shareError instanceof Error
                ? shareError.message
                : 'No se pudo importar el contenido compartido en OANIX.',
            )
            return
          }

          if (!active) return
          setProgress(null)
          if (!note) return

          onImportedRef.current(note)
          openImportedNoteWhenReady(note.id)

          setMessage('Contenido compartido guardado en una nota nueva y cifrada.')
          if (messageTimer !== null) window.clearTimeout(messageTimer)
          messageTimer = window.setTimeout(() => setMessage(''), 3200)

          // Drain one more item. If Android queued another share while this one was being
          // encrypted, it is processed immediately; if the queue is empty the next call returns
          // available=false and exits without creating anything.
          rerunRequested = true
        } while (active && rerunRequested)
      } finally {
        processing = false
        if (active && rerunRequested) void processPendingShares()
      }
    }

    void addAndroidShareReceivedListener(() => {
      rerunRequested = true
      void processPendingShares()
    })
      .then((handle) => {
        if (!active) {
          void handle.remove()
          return
        }
        listenerHandle = handle
        void processPendingShares()
      })
      .catch(() => {
        // Cold-start import still works even if listener registration itself fails.
        if (active) void processPendingShares()
      })

    return () => {
      active = false
      setProgress(null)
      if (listenerHandle) void listenerHandle.remove()
      if (messageTimer !== null) window.clearTimeout(messageTimer)
      if (openTimerRef.current !== null) {
        window.clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
    }
  }, [])

  if (!isAndroidNativeShareRuntime() || (!progress && !message && !error)) return null

  const statusText = progress?.message || error || message

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
        display: 'grid',
        gap: '.6rem',
        padding: '.82rem .9rem',
        border: '1px solid rgba(148,163,184,.28)',
        borderRadius: '.9rem',
        background: 'rgba(15,23,42,.97)',
        color: '#eef5ff',
        boxShadow: '0 16px 45px rgba(0,0,0,.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem' }}>
        <span style={{ minWidth: 0, fontWeight: 750 }}>{statusText}</span>
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
      </div>

      {progress && (
        <>
          <div
            role="progressbar"
            aria-label="Progreso de importación del contenido compartido"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            style={{
              width: '100%',
              height: '.42rem',
              overflow: 'hidden',
              borderRadius: '999px',
              background: 'rgba(255,255,255,.13)',
            }}
          >
            <div
              style={{
                width: `${Math.max(2, Math.min(100, progress.percent))}%`,
                height: '100%',
                borderRadius: 'inherit',
                background: 'currentColor',
                transition: 'width .2s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', fontSize: '.74rem', opacity: .72 }}>
            <span>Cifrado local · no requiere Internet</span>
            <span>{progress.percent}%</span>
          </div>
        </>
      )}
    </aside>
  )
}
