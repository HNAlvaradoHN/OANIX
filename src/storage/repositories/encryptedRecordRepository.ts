import {
  decryptVaultJson,
  encryptVaultJson,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import { ENCRYPTED_RECORDS_STORE, openLocalDatabase } from '../local/database'

interface StoredEncryptedRecord {
  key: string
  payload: EncryptedVaultPayload
}

function encryptedRecordKey(recordType: string, recordId: string): string {
  if (!recordType || !recordId) {
    throw new Error('Encrypted records require a type and an id.')
  }

  return JSON.stringify([recordType, recordId])
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Local transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local transaction was aborted.'))
  })
}

export async function writeEncryptedRecord<T>(
  recordType: string,
  recordId: string,
  value: T,
): Promise<void> {
  const vaultKey = requireActiveVaultKey()
  const context = { recordType, recordId }
  const payload = await encryptVaultJson(vaultKey, value, context)
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readwrite')
    const completion = transactionCompleted(transaction)
    const storedRecord: StoredEncryptedRecord = {
      key: encryptedRecordKey(recordType, recordId),
      payload,
    }
    transaction.objectStore(ENCRYPTED_RECORDS_STORE).put(storedRecord)
    await completion
  } finally {
    database.close()
  }
}

export async function readEncryptedRecord<T>(
  recordType: string,
  recordId: string,
): Promise<T | null> {
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readonly')
    const completion = transactionCompleted(transaction)
    const request = transaction
      .objectStore(ENCRYPTED_RECORDS_STORE)
      .get(encryptedRecordKey(recordType, recordId))

    const storedRecord = await new Promise<StoredEncryptedRecord | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as StoredEncryptedRecord | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read encrypted record.'))
    })

    await completion

    if (!storedRecord) {
      return null
    }

    const vaultKey = requireActiveVaultKey()
    return decryptVaultJson<T>(vaultKey, storedRecord.payload, { recordType, recordId })
  } finally {
    database.close()
  }
}

export async function deleteEncryptedRecord(recordType: string, recordId: string): Promise<void> {
  requireActiveVaultKey()
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readwrite')
    const completion = transactionCompleted(transaction)
    transaction
      .objectStore(ENCRYPTED_RECORDS_STORE)
      .delete(encryptedRecordKey(recordType, recordId))
    await completion
  } finally {
    database.close()
  }
}
