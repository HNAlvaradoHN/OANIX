import { decryptVaultJson, encryptVaultJson, type EncryptedVaultPayload } from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import { readEncryptedRecord, writeEncryptedRecord } from '../../storage/repositories/encryptedRecordRepository'
import {
  applyStoredEncryptedRecordChanges,
  readStoredEncryptedRecordsMatching,
  type StoredEncryptedSnapshotRecord,
} from '../../storage/repositories/vaultSnapshotRepository'
import { getOnlineAccountSession, getOnlineDataClient } from '../account/accountService'
import { isNoteRecord, type NoteRecord, type StoredNoteBlock } from '../notes/noteTypes'

const ENVELOPE_PROTOCOL = 'oanix-sync-envelope-v1' as const
const ENVELOPE_TYPE = 'sync-envelope'
const SYNC_STATE_TYPE = 'system.sync-state'
const SYNC_STATE_ID = 'primary'
const BOOTSTRAP_KEY = 'vault-bootstrap-v1'
const SKIP_TYPES = new Set(['image', 'image-preview', SYNC_STATE_TYPE, 'system.encryption-check'])

interface SyncEnvelope {
  protocol: typeof ENVELOPE_PROTOCOL
  localKey: string
  payload: EncryptedVaultPayload
}
interface RemoteRow {
  record_key: string
  ciphertext: string | null
  version: number
  deleted: boolean
}
interface StateEntry {
  remoteKey: string
  version: number
  fingerprint: string
  deleted: boolean
}
interface SyncState {
  version: 1
  entries: Record<string, StateEntry>
}
interface InternalConflict {
  localKey: string
  recordType: string
  recordId: string
  remoteKey: string
  remoteVersion: number
  localDeleted: boolean
  remoteDeleted: boolean
  localPayload: EncryptedVaultPayload | null
  remotePayload: EncryptedVaultPayload | null
  token: string
  resolvable: boolean
  reason: string
}

export type SyncConflictResolutionChoice = 'local' | 'remote' | 'combine'
export interface SyncConflictSide { deleted: boolean; value: unknown }
export interface SyncConflictView {
  localKey: string
  token: string
  label: string
  recordType: string
  recordId: string
  resolvable: boolean
  reason: string
  remoteAcceptedFirst: true
  local: SyncConflictSide
  remote: SyncConflictSide
  canCombine: boolean
  combineReason: string
}

function parseKey(key: string): { recordType: string; recordId: string } | null {
  try {
    const value = JSON.parse(key)
    if (Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === 'string' && item.length > 0)) {
      return { recordType: value[0], recordId: value[1] }
    }
  } catch { return null }
  return null
}

function isPayload(value: unknown): value is EncryptedVaultPayload {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<EncryptedVaultPayload>
  return item.scheme === 'aes-gcm-v1' && typeof item.iv === 'string' && typeof item.ciphertext === 'string' && item.iv.length > 0 && item.ciphertext.length > 0
}

function requireRow(value: unknown): RemoteRow {
  if (!value || typeof value !== 'object') throw new Error('Supabase devolvió un registro de sincronización inválido.')
  const row = value as Partial<RemoteRow>
  const ciphertextOk = row.deleted === true ? row.ciphertext === null : typeof row.ciphertext === 'string' && row.ciphertext.length > 0
  if (typeof row.record_key !== 'string' || !row.record_key || !Number.isSafeInteger(row.version) || (row.version ?? 0) <= 0 || typeof row.deleted !== 'boolean' || !ciphertextOk) {
    throw new Error('Supabase devolvió metadatos de sincronización inválidos.')
  }
  return row as RemoteRow
}

function samePayload(left: EncryptedVaultPayload | null, right: EncryptedVaultPayload | null) {
  if (!left || !right) return left === right
  return left.scheme === right.scheme && left.iv === right.iv && left.ciphertext === right.ciphertext
}

async function fingerprint(payload: EncryptedVaultPayload) {
  if (!crypto?.subtle) throw new Error('Web Crypto no está disponible para comprobar conflictos.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function readState(): Promise<SyncState> {
  const value = await readEncryptedRecord<unknown>(SYNC_STATE_TYPE, SYNC_STATE_ID)
  if (value === null) return { version: 1, entries: {} }
  if (!value || typeof value !== 'object') throw new Error('El estado cifrado de sincronización está dañado.')
  const state = value as Partial<SyncState>
  if (state.version !== 1 || !state.entries || typeof state.entries !== 'object') throw new Error('El estado cifrado de sincronización no es compatible.')
  return state as SyncState
}

async function writeStateEntry(localKey: string, entry: StateEntry) {
  const state = await readState()
  state.entries[localKey] = entry
  await writeEncryptedRecord<SyncState>(SYNC_STATE_TYPE, SYNC_STATE_ID, state)
}

async function decryptEnvelope(vaultKey: CryptoKey, row: RemoteRow): Promise<SyncEnvelope> {
  if (row.deleted || !row.ciphertext) throw new Error('No se puede descifrar un registro remoto eliminado.')
  let encrypted: unknown
  try { encrypted = JSON.parse(row.ciphertext) } catch { throw new Error('El servidor devolvió un sobre E2EE ilegible.') }
  if (!isPayload(encrypted)) throw new Error('El servidor devolvió un sobre E2EE inválido.')
  const value = await decryptVaultJson<unknown>(vaultKey, encrypted, { recordType: ENVELOPE_TYPE, recordId: row.record_key })
  if (!value || typeof value !== 'object') throw new Error('No se pudo validar el sobre E2EE.')
  const envelope = value as Partial<SyncEnvelope>
  if (envelope.protocol !== ENVELOPE_PROTOCOL || typeof envelope.localKey !== 'string' || !isPayload(envelope.payload)) {
    throw new Error('No se pudo validar el sobre E2EE.')
  }
  return envelope as SyncEnvelope
}

async function fetchRows(userId: string) {
  const { data, error } = await getOnlineDataClient().from('sync_records').select('record_key, ciphertext, version, deleted').eq('user_id', userId)
  if (error) throw new Error(`No se pudieron comprobar los conflictos remotos: ${error.message}`)
  return (data ?? []).map(requireRow)
}

function eligible(key: string) {
  const parsed = parseKey(key)
  return Boolean(parsed && !SKIP_TYPES.has(parsed.recordType))
}

async function makeConflict(
  localKey: string,
  remote: RemoteRow,
  localPayload: EncryptedVaultPayload | null,
  remotePayload: EncryptedVaultPayload | null,
  localDeleted: boolean,
  remoteDeleted: boolean,
  resolvable = true,
  reason = '',
): Promise<InternalConflict> {
  const parsed = parseKey(localKey)
  if (!parsed) throw new Error('La clave local del conflicto es inválida.')
  const left = localDeleted || !localPayload ? 'deleted' : await fingerprint(localPayload)
  const right = remoteDeleted || !remotePayload ? 'deleted' : await fingerprint(remotePayload)
  return {
    localKey,
    recordType: parsed.recordType,
    recordId: parsed.recordId,
    remoteKey: remote.record_key,
    remoteVersion: remote.version,
    localDeleted,
    remoteDeleted,
    localPayload,
    remotePayload,
    token: `${remote.record_key}|${remote.version}|${left}|${right}`,
    resolvable,
    reason,
  }
}

async function scanInternal(): Promise<InternalConflict[]> {
  const session = await getOnlineAccountSession()
  if (!session) return []
  const vaultKey = requireActiveVaultKey()
  const [locals, state, rows] = await Promise.all([
    readStoredEncryptedRecordsMatching(eligible),
    readState(),
    fetchRows(session.userId),
  ])
  const localByKey = new Map(locals.map((item) => [item.key, item]))
  const rowByKey = new Map(rows.filter((row) => row.record_key !== BOOTSTRAP_KEY).map((row) => [row.record_key, row]))
  const activeByLocal = new Map<string, { row: RemoteRow; envelope: SyncEnvelope }>()

  for (const row of rows) {
    if (row.record_key === BOOTSTRAP_KEY || row.deleted) continue
    const envelope = await decryptEnvelope(vaultKey, row)
    if (!eligible(envelope.localKey)) continue
    if (activeByLocal.has(envelope.localKey)) throw new Error('La cuenta contiene dos sobres E2EE activos para el mismo registro.')
    activeByLocal.set(envelope.localKey, { row, envelope })
  }

  const keys = new Set([...localByKey.keys(), ...activeByLocal.keys(), ...Object.keys(state.entries)])
  const conflicts: InternalConflict[] = []

  for (const localKey of keys) {
    const local = localByKey.get(localKey) ?? null
    const baseline = state.entries[localKey]
    const active = activeByLocal.get(localKey) ?? null

    if (!baseline) {
      if (local && active && await fingerprint(local.payload) !== await fingerprint(active.envelope.payload)) {
        conflicts.push(await makeConflict(localKey, active.row, local.payload, active.envelope.payload, false, false))
      }
      continue
    }

    const remote = rowByKey.get(baseline.remoteKey)
    if (!remote) {
      if (active) {
        conflicts.push(await makeConflict(localKey, active.row, local?.payload ?? null, active.envelope.payload, !local, false))
        continue
      }
      const synthetic: RemoteRow = { record_key: baseline.remoteKey, ciphertext: null, version: baseline.version, deleted: true }
      conflicts.push(await makeConflict(localKey, synthetic, local?.payload ?? null, null, !local, true, false, 'La fila remota asociada ya no existe. OANIX no adivinará qué ocurrió.'))
      continue
    }
    if (active && active.row.record_key !== baseline.remoteKey) {
      if (remote.deleted) {
        // Another device can recreate the same local record under a new opaque remote key
        // after the baseline key became a tombstone. Preserve both meanings and let the
        // user choose between the active remote value and this device's current state.
        conflicts.push(await makeConflict(localKey, active.row, local?.payload ?? null, active.envelope.payload, !local, false))
        continue
      }
      conflicts.push(await makeConflict(localKey, remote, local?.payload ?? null, null, !local, remote.deleted, false, 'Existen dos identidades remotas incompatibles para el mismo registro.'))
      continue
    }

    if (remote.deleted) {
      if (!local || baseline.deleted) continue
      const localFp = await fingerprint(local.payload)
      if (localFp !== baseline.fingerprint) conflicts.push(await makeConflict(localKey, remote, local.payload, null, false, true))
      continue
    }

    const remoteEnvelope = active?.row.record_key === remote.record_key ? active.envelope : await decryptEnvelope(vaultKey, remote)
    if (remoteEnvelope.localKey !== localKey) {
      conflicts.push(await makeConflict(localKey, remote, local?.payload ?? null, remoteEnvelope.payload, !local, false, false, 'La versión remota no coincide con el registro esperado.'))
      continue
    }

    const remoteFp = await fingerprint(remoteEnvelope.payload)
    if (!local) {
      if (!baseline.deleted && remoteFp !== baseline.fingerprint) conflicts.push(await makeConflict(localKey, remote, null, remoteEnvelope.payload, true, false))
      continue
    }

    const localFp = await fingerprint(local.payload)
    if (baseline.deleted) {
      if (localFp !== remoteFp) conflicts.push(await makeConflict(localKey, remote, local.payload, remoteEnvelope.payload, false, false))
      continue
    }
    if (localFp !== baseline.fingerprint && remoteFp !== baseline.fingerprint && localFp !== remoteFp) {
      conflicts.push(await makeConflict(localKey, remote, local.payload, remoteEnvelope.payload, false, false))
    }
  }
  return conflicts
}

async function decryptValue(vaultKey: CryptoKey, conflict: InternalConflict, payload: EncryptedVaultPayload | null) {
  if (!payload) return null
  return decryptVaultJson<unknown>(vaultKey, payload, { recordType: conflict.recordType, recordId: conflict.recordId })
}

function tags(note: NoteRecord) { return note.tagIds ?? [] }
function canCombine(remote: NoteRecord, local: NoteRecord) {
  return remote.version === local.version
    && remote.id === local.id
    && remote.title === local.title
    && remote.createdAt === local.createdAt
    && (remote.folderId ?? null) === (local.folderId ?? null)
    && JSON.stringify(tags(remote)) === JSON.stringify(tags(local))
    && (remote.pinned ?? false) === (local.pinned ?? false)
    && (remote.manualOrder ?? null) === (local.manualOrder ?? null)
}

function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  if (!crypto?.getRandomValues) throw new Error('No hay un generador aleatorio seguro para combinar bloques.')
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function cloneBlock(block: StoredNoteBlock): StoredNoteBlock {
  return { ...(JSON.parse(JSON.stringify(block)) as StoredNoteBlock), id: newId() }
}

function combineNotes(remote: NoteRecord, local: NoteRecord): NoteRecord {
  if (!canCombine(remote, local)) throw new Error('Elige una versión para no inventar una mezcla de metadatos.')
  return {
    ...remote,
    updatedAt: new Date().toISOString(),
    content: {
      format: 'blocks-v1',
      blocks: [...remote.content.blocks, ...local.content.blocks.map(cloneBlock)],
    },
  }
}

export async function scanSyncConflicts(): Promise<SyncConflictView[]> {
  const conflicts = await scanInternal()
  const vaultKey = requireActiveVaultKey()
  return Promise.all(conflicts.map(async (conflict) => {
    const [remoteValue, localValue] = await Promise.all([
      conflict.remoteDeleted ? null : decryptValue(vaultKey, conflict, conflict.remotePayload),
      conflict.localDeleted ? null : decryptValue(vaultKey, conflict, conflict.localPayload),
    ])
    const notePair = !conflict.remoteDeleted && !conflict.localDeleted && isNoteRecord(remoteValue) && isNoteRecord(localValue)
    const canMerge = notePair && canCombine(remoteValue, localValue)
    const label = isNoteRecord(remoteValue) ? remoteValue.title : isNoteRecord(localValue) ? localValue.title : `${conflict.recordType} · ${conflict.recordId}`
    const combineReason = conflict.remoteDeleted || conflict.localDeleted
      ? 'Una eliminación no se combina con contenido; elige cuál versión conservar.'
      : !notePair
        ? 'La combinación automática está habilitada primero para notas compatibles.'
        : canMerge
          ? 'Se conservará primero la versión ya aceptada por la sincronización y debajo la de este dispositivo.'
          : 'Las versiones también cambiaron título, carpeta, etiquetas u organización. Elige una versión para no inventar una mezcla.'
    return {
      localKey: conflict.localKey,
      token: conflict.token,
      label: label || 'Nota sin título',
      recordType: conflict.recordType,
      recordId: conflict.recordId,
      resolvable: conflict.resolvable,
      reason: conflict.reason,
      remoteAcceptedFirst: true,
      local: { deleted: conflict.localDeleted, value: localValue },
      remote: { deleted: conflict.remoteDeleted, value: remoteValue },
      canCombine: conflict.resolvable && canMerge,
      combineReason,
    }
  }))
}

async function currentLocal(localKey: string): Promise<StoredEncryptedSnapshotRecord | null> {
  const values = await readStoredEncryptedRecordsMatching((key) => key === localKey)
  return values[0] ?? null
}

async function currentRemote(userId: string, conflict: InternalConflict) {
  const { data, error } = await getOnlineDataClient().from('sync_records')
    .select('record_key, ciphertext, version, deleted')
    .eq('user_id', userId).eq('record_key', conflict.remoteKey).single()
  if (error || !data) throw new Error('La versión sincronizada cambió. Vuelve a revisar el conflicto.')
  const row = requireRow(data)
  if (row.version !== conflict.remoteVersion || row.deleted !== conflict.remoteDeleted) throw new Error('La versión sincronizada cambió. Vuelve a revisar el conflicto.')
  return row
}

async function updateRemote(userId: string, vaultKey: CryptoKey, conflict: InternalConflict, current: RemoteRow, payload: EncryptedVaultPayload | null) {
  let ciphertext: string | null = null
  if (payload) {
    const envelope: SyncEnvelope = { protocol: ENVELOPE_PROTOCOL, localKey: conflict.localKey, payload }
    const encrypted = await encryptVaultJson(vaultKey, envelope, { recordType: ENVELOPE_TYPE, recordId: current.record_key })
    ciphertext = JSON.stringify(encrypted)
  }
  const { data, error } = await getOnlineDataClient().from('sync_records')
    .update({ ciphertext, version: current.version + 1, deleted: payload === null })
    .eq('user_id', userId).eq('record_key', current.record_key).eq('version', current.version)
    .select('record_key, ciphertext, version, deleted').single()
  if (error || !data) throw new Error('Otro dispositivo cambió esta versión mientras la resolvías. OANIX no sobrescribió nada.')
  return requireRow(data)
}

function notify(recordType: string, recordId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType, recordId } }))
  window.dispatchEvent(new CustomEvent('oanix:conflict-resolved', { detail: { recordType, recordId } }))
}

export async function resolveSyncConflict(localKey: string, token: string, choice: SyncConflictResolutionChoice) {
  const session = await getOnlineAccountSession()
  if (!session) throw new Error('Conecta tu cuenta antes de resolver conflictos.')
  const conflict = (await scanInternal()).find((item) => item.localKey === localKey)
  if (!conflict || conflict.token !== token) throw new Error('El conflicto cambió desde que lo abriste. Vuelve a revisarlo.')
  if (!conflict.resolvable) throw new Error(conflict.reason)

  const local = await currentLocal(localKey)
  if (conflict.localDeleted ? local !== null : !local || !samePayload(local.payload, conflict.localPayload)) {
    throw new Error('La versión de este dispositivo cambió. Vuelve a revisar el conflicto.')
  }

  const vaultKey = requireActiveVaultKey()
  let remote = await currentRemote(session.userId, conflict)
  if (!remote.deleted) {
    const envelope = await decryptEnvelope(vaultKey, remote)
    if (envelope.localKey !== localKey || !samePayload(envelope.payload, conflict.remotePayload)) throw new Error('La versión sincronizada cambió. Vuelve a revisar el conflicto.')
  }

  let finalPayload: EncryptedVaultPayload | null
  if (choice === 'remote') {
    finalPayload = conflict.remotePayload
    if (finalPayload) await applyStoredEncryptedRecordChanges([{ key: localKey, payload: finalPayload }], [])
    else await applyStoredEncryptedRecordChanges([], [localKey])
  } else if (choice === 'local') {
    finalPayload = conflict.localPayload
    remote = await updateRemote(session.userId, vaultKey, conflict, remote, finalPayload)
  } else {
    if (!conflict.localPayload || !conflict.remotePayload || conflict.localDeleted || conflict.remoteDeleted) throw new Error('No se puede combinar una eliminación con contenido.')
    const [remoteValue, localValue] = await Promise.all([
      decryptValue(vaultKey, conflict, conflict.remotePayload),
      decryptValue(vaultKey, conflict, conflict.localPayload),
    ])
    if (!isNoteRecord(remoteValue) || !isNoteRecord(localValue)) throw new Error('La combinación automática solo está disponible para notas compatibles.')
    const combined = combineNotes(remoteValue, localValue)
    finalPayload = await encryptVaultJson(vaultKey, combined, { recordType: conflict.recordType, recordId: conflict.recordId })
    remote = await updateRemote(session.userId, vaultKey, conflict, remote, finalPayload)
    await applyStoredEncryptedRecordChanges([{ key: localKey, payload: finalPayload }], [])
  }

  await writeStateEntry(localKey, {
    remoteKey: remote.record_key,
    version: remote.version,
    fingerprint: finalPayload ? await fingerprint(finalPayload) : '',
    deleted: finalPayload === null,
  })
  notify(conflict.recordType, conflict.recordId)
}
