import {
  deleteFolderRecord,
  listFolders,
  readFolder,
  saveFolder,
} from '../../storage/repositories/folderRepository'
import { normalizeFolderName, type FolderRecord } from './folderTypes'

const mutationQueues = new Map<string, Promise<unknown>>()

function createFolderId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function sortFolders(folders: FolderRecord[]): FolderRecord[] {
  return folders.sort((left, right) =>
    left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
  )
}

function enqueueFolderMutation(
  folderId: string,
  mutate: (folder: FolderRecord) => FolderRecord,
): Promise<FolderRecord> {
  const previous = mutationQueues.get(folderId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const existing = await readFolder(folderId)
      if (!existing) throw new Error('La carpeta ya no existe.')
      const updated = mutate(existing)
      await saveFolder(updated)
      return updated
    })

  mutationQueues.set(folderId, next)
  const cleanup = () => {
    if (mutationQueues.get(folderId) === next) mutationQueues.delete(folderId)
  }
  void next.then(cleanup, cleanup)
  return next
}

export async function loadFolders(): Promise<FolderRecord[]> {
  return sortFolders(await listFolders())
}

export async function createFolder(name: string): Promise<FolderRecord> {
  const now = new Date().toISOString()
  const folder: FolderRecord = {
    version: 1,
    id: createFolderId(),
    name: normalizeFolderName(name),
    createdAt: now,
    updatedAt: now,
  }
  await saveFolder(folder)
  return folder
}

export function renameFolder(folderId: string, name: string): Promise<FolderRecord> {
  const normalizedName = normalizeFolderName(name)
  return enqueueFolderMutation(folderId, (existing) => ({
    ...existing,
    name: normalizedName,
    updatedAt: new Date().toISOString(),
  }))
}

export function deleteFolder(folderId: string): Promise<FolderRecord> {
  const previous = mutationQueues.get(folderId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const existing = await readFolder(folderId)
      if (!existing) throw new Error('La carpeta ya no existe.')
      await deleteFolderRecord(folderId)
      return existing
    })

  mutationQueues.set(folderId, next)
  const cleanup = () => {
    if (mutationQueues.get(folderId) === next) mutationQueues.delete(folderId)
  }
  void next.then(cleanup, cleanup)
  return next
}
