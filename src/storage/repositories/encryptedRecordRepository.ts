import {
  decryptVaultJson,
  encryptVaultJson,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import { ENCRYPTED_RECORDS_STORE, openLocalDatabase } from '../local/database'
import { retryTransientStorageOperation } from '../local/storageErrors'

interface StoredEncryptedRecord {
  key: string
  payload: EncryptedVaultPayload
}

export interface DecryptedRecord<T> {
  recordId: string
  value: T
}

function encryptedRecordKey(recordType: string, recordId: string): string {
  if (!recordType || !recordId) {
    throw new Error('Encrypted records require a type and an id.')
  }

  return JSON.stringify([recordType, recordId])
}

function parseEncryptedRecordKey(key: string): { recordType: string; recordId: string } | null {
  try {
    const value = JSON.parse(key)

    if (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === 'string' &&
      typeof value[1] === 'string'
    ) {
      return { recordType: value[0], recordId: value[1] }
    }
  } catch {
    return null
  }

  return null
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
  await retryTransientStorageOperation(async () => {
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
  })
}

export async function readEncryptedRecord<T>(
  recordType: string,
  recordId: string,
): Promise<T | null> {
  const vaultKey = requireActiveVaultKey()
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

    return decryptVaultJson<T>(vaultKey, storedRecord.payload, { recordType, recordId })
  } finally {
    database.close()
  }
}

export async function listEncryptedRecords<T>(recordType: string): Promise<DecryptedRecord<T>[]> {
  if (!recordType) {
    throw new Error('Encrypted records require a type.')
  }

  const vaultKey = requireActiveVaultKey()
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readonly')
    const completion = transactionCompleted(transaction)
    const request = transaction.objectStore(ENCRYPTED_RECORDS_STORE).getAll()

    const storedRecords = await new Promise<StoredEncryptedRecord[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as StoredEncryptedRecord[]) ?? [])
      request.onerror = () => reject(request.error ?? new Error('Unable to list encrypted records.'))
    })

    await completion

    const matchingRecords = storedRecords.flatMap((storedRecord) => {
      const parsed = parseEncryptedRecordKey(storedRecord.key)
      return parsed?.recordType === recordType
        ? [{ recordId: parsed.recordId, payload: storedRecord.payload }]
        : []
    })

    return Promise.all(
      matchingRecords.map(async ({ recordId, payload }) => ({
        recordId,
        value: await decryptVaultJson<T>(vaultKey, payload, { recordType, recordId }),
      })),
    )
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
