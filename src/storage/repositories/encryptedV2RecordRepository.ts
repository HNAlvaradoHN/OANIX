import {
  decryptVaultJson,
  encryptVaultJson,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import {
  openLocalDatabase,
  V2_ENCRYPTED_RECORDS_STORE,
  V2_RECORD_TYPE_INDEX,
} from '../local/database'
import { retryTransientStorageOperation } from '../local/storageErrors'

interface StoredEncryptedV2Record {
  recordType: string
  recordId: string
  payload: EncryptedVaultPayload
}

export interface EncryptedV2Write<T = unknown> {
  recordType: string
  recordId: string
  value: T
}

export interface DecryptedV2Record<T> {
  recordId: string
  value: T
}

const DECRYPT_BATCH_SIZE = 24

function validateRecordIdentity(recordType: string, recordId: string) {
  if (!recordType || !recordId) {
    throw new Error('Encrypted v2 records require a type and an id.')
  }
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Local transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local transaction was aborted.'))
  })
}

function requestResult<T>(request: IDBRequest<T>, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? fallback)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

async function decryptStoredRecords<T>(
  records: StoredEncryptedV2Record[],
): Promise<DecryptedV2Record<T>[]> {
  const vaultKey = requireActiveVaultKey()
  const decrypted: DecryptedV2Record<T>[] = []

  for (let offset = 0; offset < records.length; offset += DECRYPT_BATCH_SIZE) {
    const batch = records.slice(offset, offset + DECRYPT_BATCH_SIZE)
    const values = await Promise.all(batch.map(async (record) => ({
      recordId: record.recordId,
      value: await decryptVaultJson<T>(vaultKey, record.payload, {
        recordType: record.recordType,
        recordId: record.recordId,
      }),
    })))
    decrypted.push(...values)

    if (offset + DECRYPT_BATCH_SIZE < records.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  return decrypted
}

export async function readEncryptedV2Record<T>(
  recordType: string,
  recordId: string,
): Promise<T | null> {
  validateRecordIdentity(recordType, recordId)
  const vaultKey = requireActiveVaultKey()
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(V2_ENCRYPTED_RECORDS_STORE, 'readonly')
    const completion = transactionCompleted(transaction)
    const request = transaction
      .objectStore(V2_ENCRYPTED_RECORDS_STORE)
      .get([recordType, recordId])
    const stored = await requestResult<StoredEncryptedV2Record | undefined>(request, undefined)
    await completion

    if (!stored) return null

    return decryptVaultJson<T>(vaultKey, stored.payload, { recordType, recordId })
  } finally {
    database.close()
  }
}

export async function listEncryptedV2Records<T>(
  recordType: string,
): Promise<DecryptedV2Record<T>[]> {
  if (!recordType) throw new Error('Encrypted v2 records require a type.')
  requireActiveVaultKey()
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(V2_ENCRYPTED_RECORDS_STORE, 'readonly')
    const completion = transactionCompleted(transaction)
    const index = transaction
      .objectStore(V2_ENCRYPTED_RECORDS_STORE)
      .index(V2_RECORD_TYPE_INDEX)
    const request = index.getAll(IDBKeyRange.only(recordType))
    const stored = await requestResult<StoredEncryptedV2Record[]>(request, [])
    await completion
    return decryptStoredRecords<T>(stored)
  } finally {
    database.close()
  }
}

export async function writeEncryptedV2Records(
  writes: EncryptedV2Write[],
): Promise<void> {
  if (writes.length === 0) return

  const vaultKey = requireActiveVaultKey()
  const seen = new Set<string>()

  const encrypted = await Promise.all(writes.map(async (write) => {
    validateRecordIdentity(write.recordType, write.recordId)
    const identity = JSON.stringify([write.recordType, write.recordId])
    if (seen.has(identity)) throw new Error('Duplicate encrypted v2 record write.')
    seen.add(identity)

    return {
      recordType: write.recordType,
      recordId: write.recordId,
      payload: await encryptVaultJson(vaultKey, write.value, {
        recordType: write.recordType,
        recordId: write.recordId,
      }),
    } satisfies StoredEncryptedV2Record
  }))

  await retryTransientStorageOperation(async () => {
    const database = await openLocalDatabase()

    try {
      const transaction = database.transaction(V2_ENCRYPTED_RECORDS_STORE, 'readwrite')
      const completion = transactionCompleted(transaction)
      const store = transaction.objectStore(V2_ENCRYPTED_RECORDS_STORE)
      encrypted.forEach((record) => store.put(record))
      await completion
    } finally {
      database.close()
    }
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('oanix:v2-local-data-changed', {
      detail: writes.map(({ recordType, recordId }) => ({ recordType, recordId })),
    }))
  }
}

export async function writeEncryptedV2Record<T>(
  recordType: string,
  recordId: string,
  value: T,
): Promise<void> {
  return writeEncryptedV2Records([{ recordType, recordId, value }])
}

export async function deleteEncryptedV2Record(
  recordType: string,
  recordId: string,
): Promise<void> {
  validateRecordIdentity(recordType, recordId)
  requireActiveVaultKey()

  await retryTransientStorageOperation(async () => {
    const database = await openLocalDatabase()

    try {
      const transaction = database.transaction(V2_ENCRYPTED_RECORDS_STORE, 'readwrite')
      const completion = transactionCompleted(transaction)
      transaction.objectStore(V2_ENCRYPTED_RECORDS_STORE).delete([recordType, recordId])
      await completion
    } finally {
      database.close()
    }
  })
}
