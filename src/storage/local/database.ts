const DATABASE_NAME = 'oanix-vault'
const DATABASE_VERSION = 1

export const VAULT_METADATA_STORE = 'vault_metadata'

export function openLocalDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(VAULT_METADATA_STORE)) {
        database.createObjectStore(VAULT_METADATA_STORE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open the local database.'))
    request.onblocked = () => reject(new Error('The local database upgrade is blocked by another OANIX tab.'))
  })
}
