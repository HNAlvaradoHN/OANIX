import {
  decryptVaultBytes,
  encryptVaultBytes,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import { ENCRYPTED_RECORDS_STORE, openLocalDatabase } from '../local/database'
import { retryTransientStorageOperation } from '../local/storageErrors'

interface StoredEncryptedBlob {
  key: string
  payload: EncryptedVaultPayload
}

function encryptedBlobKey(recordType: string, recordId: string): string {
  if (!recordType || !recordId) {
    throw new Error('Encrypted blobs require a type and an id.')
  }

  return JSON.stringify([recordType, recordId])
}

function notifyLocalEncryptedBlobChange(recordType: string, recordId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
    detail: { recordType, recordId },
  }))
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Local transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local transaction was aborted.'))
  })
}

export async function writeEncryptedBlob(
  recordType: string,
  recordId: string,
  bytes: Uint8Array,
): Promise<void> {
  const vaultKey = requireActiveVaultKey()
  const payload = await encryptVaultBytes(vaultKey, bytes, { recordType, recordId })
  await retryTransientStorageOperation(async () => {
    const database = await openLocalDatabase()

    try {
      const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readwrite')
      const completion = transactionCompleted(transaction)
      const storedRecord: StoredEncryptedBlob = {
        key: encryptedBlobKey(recordType, recordId),
        payload,
      }
      transaction.objectStore(ENCRYPTED_RECORDS_STORE).put(storedRecord)
      await completion
    } finally {
      database.close()
    }
  })
  notifyLocalEncryptedBlobChange(recordType, recordId)
}

export async function readEncryptedBlob(
  recordType: string,
  recordId: string,
): Promise<Uint8Array | null> {
  const vaultKey = requireActiveVaultKey()
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readonly')
    const completion = transactionCompleted(transaction)
    const request = transaction.objectStore(ENCRYPTED_RECORDS_STORE).get(encryptedBlobKey(recordType, recordId))

    const storedRecord = await new Promise<StoredEncryptedBlob | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as StoredEncryptedBlob | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read encrypted blob.'))
    })

    await completion
    if (!storedRecord) return null

    return decryptVaultBytes(vaultKey, storedRecord.payload, { recordType, recordId })
  } finally {
    database.close()
  }
}

export async function deleteEncryptedBlob(recordType: string, recordId: string): Promise<void> {
  requireActiveVaultKey()
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readwrite')
    const completion = transactionCompleted(transaction)
    transaction.objectStore(ENCRYPTED_RECORDS_STORE).delete(encryptedBlobKey(recordType, recordId))
    await completion
  } finally {
    database.close()
  }
  notifyLocalEncryptedBlobChange(recordType, recordId)
}
