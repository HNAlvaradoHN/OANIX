import type { EncryptedV2Write } from '../../storage/repositories/encryptedV2RecordRepository'
import { createPendingSyncWrite } from './incrementalNoteText'

export function currentEntityRevision(value: { revision?: number }): number {
  return Number.isSafeInteger(value.revision) && (value.revision ?? 0) > 0
    ? value.revision!
    : 1
}

export function nextEntityRevision(value: { revision?: number }): number {
  return currentEntityRevision(value) + 1
}

export function createEntityPendingWrite(
  unitType: string,
  unitId: string,
  revision: number,
  operation: 'upsert' | 'delete',
  queuedAt: string,
): EncryptedV2Write {
  return createPendingSyncWrite(
    unitId,
    unitType,
    unitId,
    revision,
    operation,
    queuedAt,
  )
}
