export const SYNC_V2_REMOTE_OBJECT_PROTOCOL = 'oanix-sync-object-v2' as const
export const SYNC_V2_BINDING_TYPE = 'sync.v2.binding'
export const SYNC_V2_ACK_TYPE = 'sync.v2.ack'
export const SYNC_V2_CURSOR_TYPE = 'sync.v2.cursor'
export const SYNC_V2_CONFLICT_TYPE = 'sync.v2.conflict'

export interface SyncV2RemoteRow {
  record_key: string
  object_key: string
  revision: number
  deleted: boolean
  content_sha256: string | null
  content_bytes: number | null
  change_seq: number
}

export interface SyncV2BindingRecord {
  version: 2
  unitType: string
  unitId: string
  recordKey: string
  objectKey: string
  revision: number
  remoteChangeSeq: number
}

export interface SyncV2AckRecord {
  version: 2
  unitType: string
  unitId: string
  revision: number
  operation: 'upsert' | 'delete'
  remoteChangeSeq: number
  acknowledgedAt: string
}

export interface SyncV2CursorRecord {
  version: 2
  lastChangeSeq: number
}

export interface SyncV2RemoteObject<T = unknown> {
  protocol: typeof SYNC_V2_REMOTE_OBJECT_PROTOCOL
  unitType: string
  unitId: string
  revision: number
  value: T
}

export interface SyncV2ConflictRecord<T = unknown> {
  version: 2
  unitType: string
  unitId: string
  localRevision: number
  remoteRevision: number
  remoteChangeSeq: number
  remoteDeleted: boolean
  remoteValue: T | null
  detectedAt: string
}

export function syncV2IdentityKey(unitType: string, unitId: string): string {
  if (!unitType || !unitId) throw new Error('La identidad de sincronización v2 está incompleta.')
  return JSON.stringify([unitType, unitId])
}

export function syncV2OpaqueKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('No hay generación aleatoria segura para la sincronización v2.')
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function requireSyncV2RemoteRow(value: unknown): SyncV2RemoteRow {
  if (!value || typeof value !== 'object') throw new Error('Supabase devolvió metadata v2 inválida.')
  const row = value as Partial<SyncV2RemoteRow>
  if (
    typeof row.record_key !== 'string' || !row.record_key ||
    typeof row.object_key !== 'string' || !row.object_key ||
    !Number.isSafeInteger(row.revision) || row.revision! <= 0 ||
    typeof row.deleted !== 'boolean' ||
    (row.content_sha256 !== null && row.content_sha256 !== undefined && typeof row.content_sha256 !== 'string') ||
    (row.content_bytes !== null && row.content_bytes !== undefined && (!Number.isSafeInteger(row.content_bytes) || row.content_bytes! < 0)) ||
    !Number.isSafeInteger(row.change_seq) || row.change_seq! <= 0
  ) {
    throw new Error('Supabase devolvió metadata v2 inválida.')
  }
  return row as SyncV2RemoteRow
}

export function pendingNeedsUpload(
  pending: { revision: number; operation: 'upsert' | 'delete' },
  ack: Pick<SyncV2AckRecord, 'revision' | 'operation'> | null,
): boolean {
  if (!ack) return true
  return pending.revision !== ack.revision || pending.operation !== ack.operation
}

export function canApplyRemoteChange(
  row: SyncV2RemoteRow,
  binding: SyncV2BindingRecord | null,
  hasUnsyncedLocalChange: boolean,
): 'skip-self' | 'apply' | 'conflict' {
  if (binding && row.change_seq <= binding.remoteChangeSeq) return 'skip-self'
  if (hasUnsyncedLocalChange) return 'conflict'
  return 'apply'
}
