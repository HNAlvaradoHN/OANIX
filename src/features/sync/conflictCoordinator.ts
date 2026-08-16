import {
  resolveSyncConflict as resolveRecordConflict,
  scanSyncConflicts as scanRecordConflicts,
  type SyncConflictResolutionChoice,
  type SyncConflictSide,
  type SyncConflictView,
} from './conflictService'
import {
  loadBinaryImageConflictVisuals,
  resolveBinarySyncConflict,
  scanBinarySyncConflicts,
  type BinaryImageConflictVisuals,
} from './binaryConflictService'

export type { SyncConflictResolutionChoice, SyncConflictSide, SyncConflictView }
export type { BinaryImageConflictVisuals }
export { isBinaryImageConflictSide } from './binaryConflictService'

function recordTypeFromLocalKey(localKey: string): string | null {
  try {
    const value = JSON.parse(localKey)
    return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null
  } catch {
    return null
  }
}

export async function scanSyncConflicts(): Promise<SyncConflictView[]> {
  const [records, images] = await Promise.all([
    scanRecordConflicts(),
    scanBinarySyncConflicts(),
  ])
  return [...records, ...images]
}

export async function resolveSyncConflict(
  localKey: string,
  token: string,
  choice: SyncConflictResolutionChoice,
) {
  if (recordTypeFromLocalKey(localKey) === 'image') {
    return resolveBinarySyncConflict(localKey, token, choice)
  }
  return resolveRecordConflict(localKey, token, choice)
}

export async function loadImageConflictVisuals(localKey: string, token: string) {
  if (recordTypeFromLocalKey(localKey) !== 'image') return null
  return loadBinaryImageConflictVisuals(localKey, token)
}
