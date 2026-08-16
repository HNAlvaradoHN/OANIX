import type { EncryptedVaultPayload } from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import {
  ENCRYPTED_RECORDS_STORE,
  openLocalDatabase,
  VAULT_METADATA_STORE,
} from '../local/database'
import type { VaultMetadata } from './vaultRepository'

export interface StoredEncryptedSnapshotRecord {
  key: string
  payload: EncryptedVaultPayload
}

export interface LocalVaultSnapshot {
  metadata: VaultMetadata
  records: StoredEncryptedSnapshotRecord[]
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Local transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local transaction was aborted.'))
  })
}

export async function readLocalVaultSnapshot(): Promise<LocalVaultSnapshot> {
  requireActiveVaultKey()
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(
      [VAULT_METADATA_STORE, ENCRYPTED_RECORDS_STORE],
      'readonly',
    )
    const completion = transactionCompleted(transaction)
    const metadataRequest = transaction.objectStore(VAULT_METADATA_STORE).get('primary')
    const recordsRequest = transaction.objectStore(ENCRYPTED_RECORDS_STORE).getAll()

    const [metadata, records] = await Promise.all([
      new Promise<VaultMetadata | null>((resolve, reject) => {
        metadataRequest.onsuccess = () => resolve((metadataRequest.result as VaultMetadata | undefined) ?? null)
        metadataRequest.onerror = () => reject(metadataRequest.error ?? new Error('Unable to read vault metadata.'))
      }),
      new Promise<StoredEncryptedSnapshotRecord[]>((resolve, reject) => {
        recordsRequest.onsuccess = () => resolve((recordsRequest.result as StoredEncryptedSnapshotRecord[]) ?? [])
        recordsRequest.onerror = () => reject(recordsRequest.error ?? new Error('Unable to read encrypted records.'))
      }),
    ])

    await completion
    if (!metadata || metadata.protection === 'pending') {
      throw new Error('La bóveda debe tener una contraseña maestra antes de crear un backup.')
    }

    return { metadata, records }
  } finally {
    database.close()
  }
}

export async function readStoredEncryptedRecordsMatching(
  includeKey: (key: string) => boolean,
): Promise<StoredEncryptedSnapshotRecord[]> {
  requireActiveVaultKey()
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(ENCRYPTED_RECORDS_STORE, 'readonly')
    const completion = transactionCompleted(transaction)
    const request = transaction.objectStore(ENCRYPTED_RECORDS_STORE).openCursor()

    const records = await new Promise<StoredEncryptedSnapshotRecord[]>((resolve, reject) => {
      const matching: StoredEncryptedSnapshotRecord[] = []

      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve(matching)
          return
        }

        const value = cursor.value as StoredEncryptedSnapshotRecord | undefined
        if (
          value &&
          typeof value.key === 'string' &&
          includeKey(value.key)
        ) {
          matching.push(value)
        }
        cursor.continue()
      }
      request.onerror = () => reject(request.error ?? new Error('Unable to scan encrypted records.'))
    })

    await completion
    return records
  } finally {
    database.close()
  }
}

export async function replaceLocalVaultSnapshot(snapshot: LocalVaultSnapshot): Promise<void> {
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(
      [VAULT_METADATA_STORE, ENCRYPTED_RECORDS_STORE],
      'readwrite',
    )
    const completion = transactionCompleted(transaction)
    const metadataStore = transaction.objectStore(VAULT_METADATA_STORE)
    const recordsStore = transaction.objectStore(ENCRYPTED_RECORDS_STORE)

    metadataStore.clear()
    recordsStore.clear()
    metadataStore.put(snapshot.metadata)
    snapshot.records.forEach((record) => recordsStore.put(record))

    await completion
  } finally {
    database.close()
  }
}
