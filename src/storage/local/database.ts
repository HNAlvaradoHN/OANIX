const DATABASE_NAME = 'oanix-vault'
const DATABASE_VERSION = 2

export const VAULT_METADATA_STORE = 'vault_metadata'
export const ENCRYPTED_RECORDS_STORE = 'encrypted_records'

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

      if (!database.objectStoreNames.contains(ENCRYPTED_RECORDS_STORE)) {
        database.createObjectStore(ENCRYPTED_RECORDS_STORE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to open the local database.'))
    request.onblocked = () => reject(new Error('The local database upgrade is blocked by another OANIX tab.'))
  })
}
