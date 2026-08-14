import { openLocalDatabase, VAULT_METADATA_STORE } from '../local/database'

export interface VaultMetadata {
  key: 'primary'
  schemaVersion: 1
  createdAt: string
  protection: 'pending'
}

const PRIMARY_VAULT_KEY = 'primary'

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Local transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local transaction was aborted.'))
  })
}

export async function readVaultMetadata(): Promise<VaultMetadata | null> {
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(VAULT_METADATA_STORE, 'readonly')
    const store = transaction.objectStore(VAULT_METADATA_STORE)
    const request = store.get(PRIMARY_VAULT_KEY)

    const metadata = await new Promise<VaultMetadata | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as VaultMetadata | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read vault metadata.'))
    })

    await transactionCompleted(transaction)
    return metadata
  } finally {
    database.close()
  }
}

export async function writeVaultMetadata(metadata: VaultMetadata): Promise<void> {
  const database = await openLocalDatabase()

  try {
    const transaction = database.transaction(VAULT_METADATA_STORE, 'readwrite')
    transaction.objectStore(VAULT_METADATA_STORE).put(metadata)
    await transactionCompleted(transaction)
  } finally {
    database.close()
  }
}
