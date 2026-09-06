import {
  decryptVaultJson,
  encryptVaultJson,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import {
  applyEncryptedV2Changes,
  deleteEncryptedV2RecordIfValueMatches,
  listEncryptedV2Records,
  readEncryptedV2Record,
  readEncryptedV2Records,
  type EncryptedV2Write,
} from '../../storage/repositories/encryptedV2RecordRepository'
import { getOnlineDataClient } from '../account/accountService'
import { SYNC_V2_PENDING_TYPE, type SyncV2PendingRecord } from '../rebuild/rebuildModel'
import {
  deleteEncryptedR2Object,
  getEncryptedR2Object,
  isR2ObjectApiConfigured,
  putEncryptedR2Object,
} from './r2ObjectApi'
import {
  SYNC_V2_ACK_TYPE,
  SYNC_V2_BINDING_TYPE,
  SYNC_V2_CONFLICT_TYPE,
  SYNC_V2_CURSOR_TYPE,
  SYNC_V2_REMOTE_OBJECT_PROTOCOL,
  canApplyRemoteChange,
  pendingNeedsUpload,
  requireSyncV2RemoteRow,
  syncV2IdentityKey,
  syncV2OpaqueKey,
  type SyncV2AckRecord,
  type SyncV2BindingRecord,
  type SyncV2ConflictRecord,
  type SyncV2CursorRecord,
  type SyncV2RemoteObject,
  type SyncV2RemoteRow,
} from './v2RemoteSyncProtocol'

const REMOTE_OBJECT_RECORD_TYPE = 'sync.v2.remote-object'
const SYNC_V2_GC_TYPE = 'sync.v2.gc'
const SYNC_V2_REMOTE_BINDING_TYPE = 'sync.v2.remote-binding'
const CURSOR_RECORD_ID = 'primary'
const PULL_BATCH_SIZE = 48
const UPLOAD_BATCH_SIZE = 24

interface SyncV2GcRecord {
  version: 2
  objectKey: string
  queuedAt: string
}

interface UploadQueueEntry {
  pending: SyncV2PendingRecord
  ack: SyncV2AckRecord | null
  binding: SyncV2BindingRecord | null
}

export interface SyncV2RunResult {
  configured: boolean
  authenticated: boolean
  uploaded: number
  downloaded: number
  deletedLocal: number
  deletedRemote: number
  conflicts: number
  skipped: number
}

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Sincronización cancelada.', 'AbortError')
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function parseEncryptedPayload(serialized: string): EncryptedVaultPayload {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    throw new Error('R2 devolvió un objeto cifrado ilegible.')
  }
  if (!value || typeof value !== 'object') throw new Error('R2 devolvió un objeto cifrado inválido.')
  const payload = value as Partial<EncryptedVaultPayload>
  if (payload.scheme !== 'aes-gcm-v1' || typeof payload.iv !== 'string' || typeof payload.ciphertext !== 'string') {
    throw new Error('R2 devolvió un objeto cifrado inválido.')
  }
  return payload as EncryptedVaultPayload
}

function bindingRecordId(unitType: string, unitId: string): string {
  return syncV2IdentityKey(unitType, unitId)
}

function ackRecordId(unitType: string, unitId: string): string {
  return syncV2IdentityKey(unitType, unitId)
}

function conflictRecordId(unitType: string, unitId: string): string {
  return syncV2IdentityKey(unitType, unitId)
}

function bindingWrites(binding: SyncV2BindingRecord): EncryptedV2Write[] {
  return [
    {
      recordType: SYNC_V2_BINDING_TYPE,
      recordId: bindingRecordId(binding.unitType, binding.unitId),
      value: binding,
    },
    {
      recordType: SYNC_V2_REMOTE_BINDING_TYPE,
      recordId: binding.recordKey,
      value: binding,
    },
  ]
}

function gcWrite(objectKey: string): EncryptedV2Write<SyncV2GcRecord> {
  return {
    recordType: SYNC_V2_GC_TYPE,
    recordId: objectKey,
    value: { version: 2, objectKey, queuedAt: new Date().toISOString() },
  }
}

async function drainObjectGarbage(accessToken: string, signal?: AbortSignal): Promise<void> {
  const records = await listEncryptedV2Records<SyncV2GcRecord>(SYNC_V2_GC_TYPE)
  for (const record of records) {
    abortIfNeeded(signal)
    try {
      await deleteEncryptedR2Object(record.value.objectKey, accessToken)
      await applyEncryptedV2Changes({
        deletes: [{ recordType: SYNC_V2_GC_TYPE, recordId: record.recordId }],
      })
    } catch {
      // Garbage is retried on the next safe sync run. It must never make note sync destructive.
    }
  }
}

async function currentSession() {
  const supabase = getOnlineDataClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

async function clearAcknowledgedPending(pending: SyncV2PendingRecord): Promise<void> {
  await deleteEncryptedV2RecordIfValueMatches(
    SYNC_V2_PENDING_TYPE,
    syncV2IdentityKey(pending.unitType, pending.unitId),
    pending,
  )
}

async function writeAckAndBinding(
  pending: SyncV2PendingRecord,
  binding: SyncV2BindingRecord | null,
  row: SyncV2RemoteRow | null,
): Promise<void> {
  const acknowledgedAt = new Date().toISOString()
  const remoteChangeSeq = row?.change_seq ?? binding?.remoteChangeSeq ?? 0
  const ack: SyncV2AckRecord = {
    version: 2,
    unitType: pending.unitType,
    unitId: pending.unitId,
    revision: pending.revision,
    operation: pending.operation,
    remoteChangeSeq,
    acknowledgedAt,
  }
  const writes: EncryptedV2Write[] = [{
    recordType: SYNC_V2_ACK_TYPE,
    recordId: ackRecordId(pending.unitType, pending.unitId),
    value: ack,
  }]

  if (row) {
    const nextBinding: SyncV2BindingRecord = {
      version: 2,
      unitType: pending.unitType,
      unitId: pending.unitId,
      recordKey: row.record_key,
      objectKey: row.object_key,
      revision: row.revision,
      remoteChangeSeq: row.change_seq,
    }
    writes.push(...bindingWrites(nextBinding))
  }

  await applyEncryptedV2Changes({ writes })
}

async function uploadOne(
  pending: SyncV2PendingRecord,
  ack: SyncV2AckRecord | null,
  binding: SyncV2BindingRecord | null,
  userId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<'uploaded' | 'deleted' | 'skipped' | 'conflict'> {
  if (!pendingNeedsUpload(pending, ack)) return 'skipped'
  abortIfNeeded(signal)

  const supabase = getOnlineDataClient()
  if (pending.operation === 'delete' && !binding) {
    // Created and deleted before its first remote commit: there is nothing to tombstone remotely.
    await writeAckAndBinding(pending, null, null)
    await clearAcknowledgedPending(pending)
    return 'skipped'
  }

  const recordKey = binding?.recordKey ?? syncV2OpaqueKey()
  const previousObjectKey = binding?.objectKey ?? null
  let nextObjectKey = previousObjectKey ?? syncV2OpaqueKey()
  let serializedPayload: string | null = null
  let contentHash: string | null = null
  let contentBytes: number | null = null

  if (pending.operation === 'upsert') {
    const value = await readEncryptedV2Record<unknown>(pending.unitType, pending.unitId)
    if (value === null) throw new Error('La cola v2 apunta a un registro local que ya no existe.')
    const remoteObject: SyncV2RemoteObject = {
      protocol: SYNC_V2_REMOTE_OBJECT_PROTOCOL,
      unitType: pending.unitType,
      unitId: pending.unitId,
      revision: pending.revision,
      value,
    }
    const payload = await encryptVaultJson(requireActiveVaultKey(), remoteObject, {
      recordType: REMOTE_OBJECT_RECORD_TYPE,
      recordId: recordKey,
    })
    serializedPayload = JSON.stringify(payload)
    contentHash = await sha256Base64Url(serializedPayload)
    contentBytes = new TextEncoder().encode(serializedPayload).byteLength
    nextObjectKey = syncV2OpaqueKey()
    await putEncryptedR2Object(nextObjectKey, accessToken, serializedPayload)
  }

  // Once a fresh immutable R2 object exists, finish the metadata commit for this unit.
  // Aborting in this narrow window would strand an unreferenced object. The outer loop
  // observes the aborted signal before starting another unit or before pulling remote work.
  const patch = {
    object_key: nextObjectKey,
    revision: pending.revision,
    deleted: pending.operation === 'delete',
    content_sha256: contentHash,
    content_bytes: contentBytes,
  }

  let remoteValue: unknown = null
  let remoteError: unknown = null
  if (binding) {
    const result = await supabase
      .from('sync_v2_records')
      .update(patch)
      .eq('record_key', recordKey)
      .eq('change_seq', binding.remoteChangeSeq)
      .select('record_key, object_key, revision, deleted, content_sha256, content_bytes, change_seq')
      .maybeSingle()
    remoteValue = result.data
    remoteError = result.error
  } else {
    const result = await supabase
      .from('sync_v2_records')
      .insert({ user_id: userId, record_key: recordKey, ...patch })
      .select('record_key, object_key, revision, deleted, content_sha256, content_bytes, change_seq')
      .single()
    remoteValue = result.data
    remoteError = result.error
  }

  if (remoteError) {
    if (serializedPayload) await deleteEncryptedR2Object(nextObjectKey, accessToken).catch(() => undefined)
    throw remoteError
  }
  if (!remoteValue) {
    if (serializedPayload) await deleteEncryptedR2Object(nextObjectKey, accessToken).catch(() => undefined)
    return 'conflict'
  }

  const row = requireSyncV2RemoteRow(remoteValue)
  await writeAckAndBinding(pending, binding, row)
  await clearAcknowledgedPending(pending)

  if (
    previousObjectKey
    && (pending.operation === 'delete' || previousObjectKey !== row.object_key)
  ) {
    await applyEncryptedV2Changes({ writes: [gcWrite(previousObjectKey)] })
  }

  return pending.operation === 'delete' ? 'deleted' : 'uploaded'
}

async function loadUploadQueue(): Promise<UploadQueueEntry[]> {
  const pendingRecords = await listEncryptedV2Records<SyncV2PendingRecord>(SYNC_V2_PENDING_TYPE)
  if (pendingRecords.length === 0) return []

  const ackIdentities = pendingRecords.map((record) => ({
    recordType: SYNC_V2_ACK_TYPE,
    recordId: record.recordId,
  }))
  const bindingIdentities = pendingRecords.map((record) => ({
    recordType: SYNC_V2_BINDING_TYPE,
    recordId: record.recordId,
  }))
  const [acks, bindings] = await Promise.all([
    readEncryptedV2Records<SyncV2AckRecord>(ackIdentities),
    readEncryptedV2Records<SyncV2BindingRecord>(bindingIdentities),
  ])

  return pendingRecords.map((record, index) => ({
    pending: record.value,
    ack: acks[index],
    binding: bindings[index],
  }))
}

async function uploadPending(
  userId: string,
  accessToken: string,
  result: SyncV2RunResult,
  signal?: AbortSignal,
): Promise<void> {
  const queue = await loadUploadQueue()
  const dirty = queue
    .filter((entry) => pendingNeedsUpload(entry.pending, entry.ack))
    .sort((left, right) => left.pending.queuedAt.localeCompare(right.pending.queuedAt))
    .slice(0, UPLOAD_BATCH_SIZE)

  for (const entry of dirty) {
    abortIfNeeded(signal)
    const outcome = await uploadOne(
      entry.pending,
      entry.ack,
      entry.binding,
      userId,
      accessToken,
      signal,
    )
    if (outcome === 'uploaded') result.uploaded += 1
    else if (outcome === 'deleted') result.deletedRemote += 1
    else if (outcome === 'conflict') result.conflicts += 1
    else result.skipped += 1
  }
}

async function readRemoteObject(
  row: SyncV2RemoteRow,
  accessToken: string,
): Promise<SyncV2RemoteObject> {
  const serialized = await getEncryptedR2Object(row.object_key, accessToken)
  if (row.content_bytes !== null && new TextEncoder().encode(serialized).byteLength !== row.content_bytes) {
    throw new Error('El tamaño del objeto remoto no coincide con la metadata de sincronización.')
  }
  if (row.content_sha256 && await sha256Base64Url(serialized) !== row.content_sha256) {
    throw new Error('El objeto remoto no coincide con su hash de sincronización.')
  }
  const value = await decryptVaultJson<SyncV2RemoteObject>(
    requireActiveVaultKey(),
    parseEncryptedPayload(serialized),
    { recordType: REMOTE_OBJECT_RECORD_TYPE, recordId: row.record_key },
  )
  if (
    value.protocol !== SYNC_V2_REMOTE_OBJECT_PROTOCOL ||
    !value.unitType || !value.unitId ||
    value.revision !== row.revision
  ) {
    throw new Error('El objeto remoto v2 no coincide con su metadata.')
  }
  return value
}

async function recordConflict(
  remoteObject: SyncV2RemoteObject,
  row: SyncV2RemoteRow,
  localRevision: number,
): Promise<void> {
  const conflict: SyncV2ConflictRecord = {
    version: 2,
    unitType: remoteObject.unitType,
    unitId: remoteObject.unitId,
    localRevision,
    remoteRevision: row.revision,
    remoteChangeSeq: row.change_seq,
    remoteDeleted: false,
    remoteValue: remoteObject.value,
    detectedAt: new Date().toISOString(),
  }
  await applyEncryptedV2Changes({
    writes: [{
      recordType: SYNC_V2_CONFLICT_TYPE,
      recordId: conflictRecordId(remoteObject.unitType, remoteObject.unitId),
      value: conflict,
    }],
  })
}

async function recordTombstoneConflict(
  binding: SyncV2BindingRecord,
  row: SyncV2RemoteRow,
  localRevision: number,
): Promise<void> {
  const conflict: SyncV2ConflictRecord = {
    version: 2,
    unitType: binding.unitType,
    unitId: binding.unitId,
    localRevision,
    remoteRevision: row.revision,
    remoteChangeSeq: row.change_seq,
    remoteDeleted: true,
    remoteValue: null,
    detectedAt: new Date().toISOString(),
  }
  await applyEncryptedV2Changes({
    writes: [{
      recordType: SYNC_V2_CONFLICT_TYPE,
      recordId: conflictRecordId(binding.unitType, binding.unitId),
      value: conflict,
    }],
  })
}

async function saveCursor(changeSeq: number): Promise<void> {
  const cursor: SyncV2CursorRecord = { version: 2, lastChangeSeq: changeSeq }
  await applyEncryptedV2Changes({
    writes: [{ recordType: SYNC_V2_CURSOR_TYPE, recordId: CURSOR_RECORD_ID, value: cursor }],
  })
}

async function readPendingAndAck(identity: string): Promise<{
  pending: SyncV2PendingRecord | null
  ack: SyncV2AckRecord | null
}> {
  const [pending, ack] = await Promise.all([
    readEncryptedV2Record<SyncV2PendingRecord>(SYNC_V2_PENDING_TYPE, identity),
    readEncryptedV2Record<SyncV2AckRecord>(SYNC_V2_ACK_TYPE, identity),
  ])
  return { pending, ack }
}

async function pullRemote(
  result: SyncV2RunResult,
  accessToken: string,
  signal?: AbortSignal,
): Promise<void> {
  const cursor = await readEncryptedV2Record<SyncV2CursorRecord>(SYNC_V2_CURSOR_TYPE, CURSOR_RECORD_ID)
  const lastChangeSeq = cursor?.version === 2 && Number.isSafeInteger(cursor.lastChangeSeq)
    ? Math.max(0, cursor.lastChangeSeq)
    : 0
  const supabase = getOnlineDataClient()
  const response = await supabase
    .from('sync_v2_records')
    .select('record_key, object_key, revision, deleted, content_sha256, content_bytes, change_seq')
    .gt('change_seq', lastChangeSeq)
    .order('change_seq', { ascending: true })
    .limit(PULL_BATCH_SIZE)
  if (response.error) throw response.error

  for (const rawRow of response.data ?? []) {
    abortIfNeeded(signal)
    const row = requireSyncV2RemoteRow(rawRow)
    const knownBinding = await readEncryptedV2Record<SyncV2BindingRecord>(
      SYNC_V2_REMOTE_BINDING_TYPE,
      row.record_key,
    )

    if (knownBinding && row.change_seq <= knownBinding.remoteChangeSeq) {
      result.skipped += 1
      await saveCursor(row.change_seq)
      continue
    }

    if (row.deleted) {
      if (!knownBinding) {
        // This device never bound the opaque remote key, so there is no local unit to delete.
        result.skipped += 1
        await saveCursor(row.change_seq)
        continue
      }

      const identity = bindingRecordId(knownBinding.unitType, knownBinding.unitId)
      const { pending, ack } = await readPendingAndAck(identity)
      if (pending && pendingNeedsUpload(pending, ack)) {
        await recordTombstoneConflict(
          knownBinding,
          row,
          pending.revision,
        )
        result.conflicts += 1
        await saveCursor(row.change_seq)
        continue
      }

      abortIfNeeded(signal)
      const updatedBinding: SyncV2BindingRecord = {
        ...knownBinding,
        revision: row.revision,
        remoteChangeSeq: row.change_seq,
      }
      await applyEncryptedV2Changes({
        writes: [
          ...bindingWrites(updatedBinding),
          gcWrite(knownBinding.objectKey),
        ],
        deletes: [{ recordType: knownBinding.unitType, recordId: knownBinding.unitId }],
      })
      result.deletedLocal += 1
      await saveCursor(row.change_seq)
      continue
    }

    const remoteObject = await readRemoteObject(row, accessToken)
    abortIfNeeded(signal)
    const identity = syncV2IdentityKey(remoteObject.unitType, remoteObject.unitId)
    const [binding, state] = await Promise.all([
      readEncryptedV2Record<SyncV2BindingRecord>(SYNC_V2_BINDING_TYPE, identity),
      readPendingAndAck(identity),
    ])
    const hasDirtyLocal = !!state.pending && pendingNeedsUpload(state.pending, state.ack)
    const disposition = canApplyRemoteChange(row, binding, hasDirtyLocal)

    if (disposition === 'conflict') {
      await recordConflict(remoteObject, row, state.pending?.revision ?? binding?.revision ?? 1)
      result.conflicts += 1
      await saveCursor(row.change_seq)
      continue
    }
    if (disposition === 'skip-self') {
      result.skipped += 1
      await saveCursor(row.change_seq)
      continue
    }

    abortIfNeeded(signal)
    const nextBinding: SyncV2BindingRecord = {
      version: 2,
      unitType: remoteObject.unitType,
      unitId: remoteObject.unitId,
      recordKey: row.record_key,
      objectKey: row.object_key,
      revision: row.revision,
      remoteChangeSeq: row.change_seq,
    }
    await applyEncryptedV2Changes({
      writes: [
        { recordType: remoteObject.unitType, recordId: remoteObject.unitId, value: remoteObject.value },
        ...bindingWrites(nextBinding),
      ],
    })
    result.downloaded += 1
    await saveCursor(row.change_seq)
  }
}

export async function runV2IncrementalSync(signal?: AbortSignal): Promise<SyncV2RunResult> {
  const result: SyncV2RunResult = {
    configured: isR2ObjectApiConfigured(),
    authenticated: false,
    uploaded: 0,
    downloaded: 0,
    deletedLocal: 0,
    deletedRemote: 0,
    conflicts: 0,
    skipped: 0,
  }
  if (!result.configured) return result

  const session = await currentSession()
  if (!session?.user || !session.access_token) return result
  result.authenticated = true

  await drainObjectGarbage(session.access_token, signal)
  await uploadPending(session.user.id, session.access_token, result, signal)
  abortIfNeeded(signal)
  await pullRemote(result, session.access_token, signal)
  await drainObjectGarbage(session.access_token, signal)
  return result
}
