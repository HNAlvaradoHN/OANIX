import { useEffect, useRef, useState } from 'react'
import type { NoteRecord } from '../../features/notes/noteTypes'
import { importPendingAndroidShare, isAndroidNativeShareRuntime } from './nativeShare'

interface NativeShareRuntimeProps {
  onImported: (note: NoteRecord) => void
}

export function NativeShareRuntime({ onImported }: NativeShareRuntimeProps) {
  const attemptedRef = useRef(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAndroidNativeShareRuntime() || attemptedRef.current) return
    attemptedRef.current = true
    let active = true
    let messageTimer: number | null = null

    void importPendingAndroidShare()
      .then((note) => {
        if (!active || !note) return
        onImported(note)
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
    }
  }, [onImported])

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
