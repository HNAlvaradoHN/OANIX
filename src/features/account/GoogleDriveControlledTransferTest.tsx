import { useRef, useState } from 'react'
import { transferControlledGoogleDriveLargeObject } from '../largeObjects/googleDriveControlledTransfer.ts'
import { requireActiveVaultKey } from '../../security/vault/vaultSession.ts'

function randomObjectId(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return `field-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function GoogleDriveControlledTransferTest({
  disabled = false,
  onStored,
}: {
  disabled?: boolean
  onStored?: () => void | Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function transfer(file: File) {
    setBusy(true)
    setMessage('')
    try {
      await transferControlledGoogleDriveLargeObject({
        blob: file,
        vaultKey: requireActiveVaultKey(),
        objectId: randomObjectId(),
        fileName: file.name,
        mimeType: file.type || undefined,
      })
      setMessage('Prueba completada. Archivo cifrado y guardado en Google Drive.')
      await onStored?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la prueba de transferencia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: '.7rem' }}>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void transfer(file)
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        style={{ width: '100%' }}
      >
        {busy ? 'Transfiriendo prueba…' : 'Probar archivo de 100–200 MiB'}
      </button>
      <small style={{ display: 'block', marginTop: '.45rem', opacity: .78, lineHeight: 1.4 }}>
        Prueba controlada. OANIX rechazará cualquier archivo fuera de 100–200 MiB.
      </small>
      {message && (
        <p className="account-storage-card__message" role="status" style={{ marginTop: '.45rem' }}>
          {message}
        </p>
      )}
    </div>
  )
}
