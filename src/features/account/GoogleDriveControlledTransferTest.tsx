import { useRef, useState } from 'react'
import { transferControlledGoogleDriveLargeObject } from '../largeObjects/googleDriveControlledTransfer.ts'
import { createControlledLargeObjectId } from '../largeObjects/controlledLargeObjectIdentity.ts'
import {
  clearLargeObjectTransferCache,
  loadLargeObjectTransferCache,
} from '../../storage/local/largeObjectTransferCache.ts'
import { requireActiveVaultKey } from '../../security/vault/vaultSession.ts'

export function GoogleDriveControlledTransferTest({
  disabled = false,
  onStored,
}: {
  disabled?: boolean
  onStored?: () => void | Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState('')

  async function transfer(file: File) {
    setBusy(true)
    setFailed(false)
    setMessage('')
    try {
      const objectId = await createControlledLargeObjectId(file)
      await transferControlledGoogleDriveLargeObject({
        blob: file,
        vaultKey: requireActiveVaultKey(),
        objectId,
        fileName: file.name,
        mimeType: file.type || undefined,
      })
      setMessage('Prueba completada. Archivo cifrado y guardado en Google Drive.')
      await onStored?.()
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la prueba de transferencia.')
    } finally {
      setBusy(false)
    }
  }

  async function discardPendingTransfer() {
    setBusy(true)
    try {
      await clearLargeObjectTransferCache()
      const remaining = await loadLargeObjectTransferCache()
      if (remaining) {
        setFailed(true)
        setMessage('OANIX borró la transferencia, pero otra instancia o tarea volvió a crear una transferencia pendiente. Cerrá otras instancias de OANIX y volvé a descartarla.')
        return
      }
      setFailed(false)
      setMessage('Transferencia pendiente descartada y caché verificada. Ya puedes iniciar una nueva prueba.')
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? error.message : 'No se pudo descartar la transferencia pendiente.')
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
        {busy ? 'Procesando…' : 'Probar archivo de 100–200 MiB'}
      </button>
      <small style={{ display: 'block', marginTop: '.45rem', opacity: .78, lineHeight: 1.4 }}>
        Prueba controlada. OANIX rechazará cualquier archivo fuera de 100–200 MiB.
      </small>
      {message && (
        <p className="account-storage-card__message" role="status" style={{ marginTop: '.45rem' }}>
          {message}
        </p>
      )}
      {failed && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void discardPendingTransfer()}
          style={{ width: '100%', marginTop: '.45rem' }}
        >
          Descartar transferencia pendiente
        </button>
      )}
    </div>
  )
}
