import { useEffect, useRef, useState } from 'react'
import {
  isAndroidNativeDocumentsRuntime,
  openEncryptedBackupWithAndroidDocuments,
} from './nativeDocuments'

function backupInputFromTarget(target: EventTarget | null): HTMLInputElement | null {
  if (!(target instanceof Element)) return null
  const label = target.closest<HTMLLabelElement>('label.vault-restore__button')
  if (!label) return null
  const input = label.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input || !input.accept.includes('.oanixbackup')) return null
  return input
}

export function NativeDocumentsRuntime() {
  const pickerActiveRef = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAndroidNativeDocumentsRuntime()) return

    function handleBackupPickerClick(event: MouseEvent) {
      const input = backupInputFromTarget(event.target)
      if (!input) return

      event.preventDefault()
      event.stopPropagation()
      if (input.disabled || pickerActiveRef.current) return

      pickerActiveRef.current = true
      setError('')
      void openEncryptedBackupWithAndroidDocuments()
        .then((file) => {
          if (!file) return
          if (typeof DataTransfer === 'undefined') {
            throw new Error('Este WebView no puede entregar el backup seleccionado a OANIX.')
          }

          const transfer = new DataTransfer()
          transfer.items.add(file)
          input.files = transfer.files
          input.dispatchEvent(new Event('change', { bubbles: true }))
        })
        .catch((pickerError) => {
          setError(
            pickerError instanceof Error
              ? pickerError.message
              : 'No se pudo abrir el backup seleccionado en Android.',
          )
        })
        .finally(() => {
          pickerActiveRef.current = false
        })
    }

    document.addEventListener('click', handleBackupPickerClick, true)
    return () => document.removeEventListener('click', handleBackupPickerClick, true)
  }, [])

  if (!isAndroidNativeDocumentsRuntime() || !error) return null

  return (
    <aside
      role="alert"
      style={{
        position: 'fixed',
        zIndex: 2800,
        left: '50%',
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        width: 'min(32rem, calc(100vw - 1rem))',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '.75rem',
        padding: '.75rem .85rem',
        borderRadius: '.85rem',
        background: 'rgba(15,23,42,.96)',
        color: '#eef5ff',
        boxShadow: '0 16px 45px rgba(0,0,0,.3)',
      }}
    >
      <span>{error}</span>
      <button
        type="button"
        onClick={() => setError('')}
        aria-label="Cerrar error de archivos"
        style={{
          minWidth: '2.25rem',
          minHeight: '2.25rem',
          border: 0,
          borderRadius: '.6rem',
          background: 'rgba(255,255,255,.08)',
          color: 'inherit',
        }}
      >×</button>
    </aside>
  )
}
