import {
  decryptVaultJson,
  encryptVaultJson,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { openVaultProtection } from '../../security/crypto/vaultCrypto'
import {
  requireActiveVaultKey,
  setActiveVaultKey,
} from '../../security/vault/vaultSession'
import {
  readEncryptedRecord,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'
import {
  applyStoredEncryptedRecordChanges,
  readStoredEncryptedRecordsMatching,
  replaceLocalVaultSnapshot,
  type StoredEncryptedSnapshotRecord,
} from '../../storage/repositories/vaultSnapshotRepository'
import {
  readVaultMetadata,
  type VaultMetadata,
} from '../../storage/repositories/vaultRepository'
import { getOnlineAccountSession, getOnlineDataClient } from '../account/accountService'

const SYNC_ENVELOPE_PROTOCOL = 'oanix-sync-envelope-v1' as const
const SYNC_ENVELOPE_RECORD_TYPE = 'sync-envelope'
const VAULT_BOOTSTRAP_PROTOCOL = 'oanix-vault-bootstrap-v1' as const
const VAULT_BOOTSTRAP_KEY = 'vault-bootstrap-v1'
const SYNC_STATE_RECORD_TYPE = 'system.sync-state'
const SYNC_STATE_RECORD_ID = 'primary'
const BINARY_RECORD_TYPES = new Set(['image', 'image-preview'])
const LOCAL_ONLY_RECORD_TYPES = new Set([SYNC_STATE_RECORD_TYPE, 'system.encryption-check'])

interface ParsedLocalRecordKey {
  recordType: string
  recordId: string
}

interface SyncEnvelope {
  protocol: typeof SYNC_ENVELOPE_PROTOCOL
  localKey: string
  payload: EncryptedVaultPayload
}

interface RemoteSyncRow {
  record_key: string
  ciphertext: string | null
  version: number
  deleted: boolean
}

interface ExistingRemoteRecord {
  row: RemoteSyncRow
  envelope: SyncEnvelope
}

interface RemoteVaultBootstrap {
  protocol: typeof VAULT_BOOTSTRAP_PROTOCOL
  metadata: VaultMetadata
}

interface SyncStateEntry {
  remoteKey: string
  version: number
  fingerprint: string
  deleted: boolean
}

interface SyncStateRecord {
  version: 1
  entries: Record<string, SyncStateEntry>
}

export interface EncryptedSyncResult {
  uploaded: number
  verified: number
  unchanged: number
  skippedBinary: number
}

export interface BidirectionalSyncResult {
  uploaded: number
  downloaded: number
  deletedRemote: number
  deletedLocal: number
  unchanged: number
  conflicts: number
  skippedBinary: number
}

export interface RestoreSyncedVaultResult {
  recordCount: number
  skippedDeleted: number
}

function parseLocalRecordKey(key: string): ParsedLocalRecordKey | null {
  try {
    const value = JSON.parse(key)
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === 'string' &&
      value[0].length > 0 &&
      typeof value[1] === 'string' &&
      value[1].length > 0
    ) {
      return { recordType: value[0], recordId: value[1] }
    }
  } catch {
    return null
  }
  return null
}

function isEncryptedVaultPayload(value: unknown): value is EncryptedVaultPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<EncryptedVaultPayload>
  return (
    candidate.scheme === 'aes-gcm-v1' &&
    typeof candidate.iv === 'string' &&
    candidate.iv.length > 0 &&
    typeof candidate.ciphertext === 'string' &&
    candidate.ciphertext.length > 0
  )
}

function isSyncEnvelope(value: unknown): value is SyncEnvelope {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SyncEnvelope>
  return (
    candidate.protocol === SYNC_ENVELOPE_PROTOCOL &&
    typeof candidate.localKey === 'string' &&
    candidate.localKey.length > 0 &&
    isEncryptedVaultPayload(candidate.payload)
  )
}

function isVaultMetadata(value: unknown): value is VaultMetadata {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<VaultMetadata>
  return (
    candidate.key === 'primary' &&
    candidate.schemaVersion === 1 &&
    typeof candidate.createdAt === 'string' &&
    candidate.createdAt.length > 0 &&
    candidate.protection !== undefined &&
    candidate.protection !== 'pending'
  )
}

function parseRemoteVaultBootstrap(ciphertext: string | null): RemoteVaultBootstrap {
  if (!ciphertext) {
    throw new Error('La bóveda sincronizada no contiene metadatos de acceso válidos.')
  }

  let value: unknown
  try {
    value = JSON.parse(ciphertext)
  } catch {
    throw new Error('Los metadatos de la bóveda sincronizada son ilegibles.')
  }

  if (!value || typeof value !== 'object') {
    throw new Error('Los metadatos de la bóveda sincronizada son inválidos.')
  }

  const candidate = value as Partial<RemoteVaultBootstrap>
  if (candidate.protocol !== VAULT_BOOTSTRAP_PROTOCOL || !isVaultMetadata(candidate.metadata)) {
    throw new Error('La cuenta contiene una configuración de bóveda que esta versión de OANIX no reconoce.')
  }

  return candidate as RemoteVaultBootstrap
}

function encryptedPayloadMatches(
  left: EncryptedVaultPayload,
  right: EncryptedVaultPayload,
): boolean {
  return (
    left.scheme === right.scheme &&
    left.iv === right.iv &&
    left.ciphertext === right.ciphertext
  )
}

function requireRemoteRow(value: unknown): RemoteSyncRow {
  if (!value || typeof value !== 'object') {
    throw new Error('Supabase devolvió un registro de sincronización inválido.')
  }

  const row = value as Partial<RemoteSyncRow>
  const validCiphertext = row.deleted === true
    ? row.ciphertext === null
    : typeof row.ciphertext === 'string' && row.ciphertext.length > 0

  if (
    typeof row.record_key !== 'string' ||
    row.record_key.length === 0 ||
    typeof row.version !== 'number' ||
    !Number.isSafeInteger(row.version) ||
    row.version <= 0 ||
    typeof row.deleted !== 'boolean' ||
    !validCiphertext
  ) {
    throw new Error('Supabase devolvió metadatos de sincronización inválidos.')
  }

  return row as RemoteSyncRow
}

function base64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function newOpaqueRecordKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('No hay un generador aleatorio seguro para preparar la sincronización.')
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24))
  return base64Url(bytes)
}

async function payloadFingerprint(payload: EncryptedVaultPayload): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto no está disponible para comprobar la sincronización.')
  }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return base64Url(new Uint8Array(digest))
}

function isEligibleLocalKey(key: string): { eligible: boolean; binary: boolean } {
  const parsed = parseLocalRecordKey(key)
  if (!parsed) return { eligible: false, binary: false }
  if (BINARY_RECORD_TYPES.has(parsed.recordType)) return { eligible: false, binary: true }
  if (LOCAL_ONLY_RECORD_TYPES.has(parsed.recordType)) return { eligible: false, binary: false }
  return { eligible: true, binary: false }
}

async function readEligibleLocalRecords(): Promise<{
  records: StoredEncryptedSnapshotRecord[]
  skippedBinary: number
}> {
  let skippedBinary = 0
  const records = await readStoredEncryptedRecordsMatching((key) => {
    const result = isEligibleLocalKey(key)
    if (result.binary) skippedBinary += 1
    return result.eligible
  })
  return { records, skippedBinary }
}

async function encryptRecordForSync(
  vaultKey: CryptoKey,
  record: StoredEncryptedSnapshotRecord,
  recordKey: string,
): Promise<string> {
  const envelope: SyncEnvelope = {
    protocol: SYNC_ENVELOPE_PROTOCOL,
    localKey: record.key,
    payload: record.payload,
  }
  const encryptedEnvelope = await encryptVaultJson(vaultKey, envelope, {
    recordType: SYNC_ENVELOPE_RECORD_TYPE,
    recordId: recordKey,
  })

  return JSON.stringify(encryptedEnvelope)
}

async function decryptRemoteEnvelope(
  vaultKey: CryptoKey,
  row: RemoteSyncRow,
): Promise<SyncEnvelope> {
  if (row.deleted || row.ciphertext === null) {
    throw new Error('No se puede descifrar un registro remoto eliminado.')
  }

  let encryptedEnvelope: unknown
  try {
    encryptedEnvelope = JSON.parse(row.ciphertext)
  } catch {
    throw new Error('El servidor devolvió un sobre E2EE ilegible.')
  }

  if (!isEncryptedVaultPayload(encryptedEnvelope)) {
    throw new Error('El servidor devolvió un sobre E2EE inválido.')
  }

  const decoded = await decryptVaultJson<unknown>(vaultKey, encryptedEnvelope, {
    recordType: SYNC_ENVELOPE_RECORD_TYPE,
    recordId: row.record_key,
  })

  if (!isSyncEnvelope(decoded)) {
    throw new Error('No se pudo validar el contenido del sobre E2EE.')
  }

  return decoded
}

async function fetchAllRemoteRows(userId: string): Promise<RemoteSyncRow[]> {
  const client = getOnlineDataClient()
  const { data, error } = await client
    .from('sync_records')
    .select('record_key, ciphertext, version, deleted')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`No se pudo consultar el estado cifrado remoto: ${error.message}`)
  }

  return (data ?? []).map(requireRemoteRow)
}

async function fetchRemoteBootstrapRow(userId: string): Promise<RemoteSyncRow | null> {
  const client = getOnlineDataClient()
  const { data, error } = await client
    .from('sync_records')
    .select('record_key, ciphertext, version, deleted')
    .eq('user_id', userId)
    .eq('record_key', VAULT_BOOTSTRAP_KEY)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo comprobar la bóveda sincronizada: ${error.message}`)
  }
  return data ? requireRemoteRow(data) : null
}

async function readSyncState(): Promise<SyncStateRecord> {
  const stored = await readEncryptedRecord<unknown>(SYNC_STATE_RECORD_TYPE, SYNC_STATE_RECORD_ID)
  if (stored === null) return { version: 1, entries: {} }
  if (!stored || typeof stored !== 'object') {
    throw new Error('El estado local de sincronización está dañado.')
  }

  const candidate = stored as Partial<SyncStateRecord>
  if (candidate.version !== 1 || !candidate.entries || typeof candidate.entries !== 'object') {
    throw new Error('El estado local de sincronización no es compatible.')
  }

  for (const value of Object.values(candidate.entries)) {
    if (
      !value ||
      typeof value.remoteKey !== 'string' ||
      typeof value.version !== 'number' ||
      !Number.isSafeInteger(value.version) ||
      value.version <= 0 ||
      typeof value.fingerprint !== 'string' ||
      typeof value.deleted !== 'boolean'
    ) {
      throw new Error('El estado local de sincronización contiene una entrada inválida.')
    }
  }

  return candidate as SyncStateRecord
}

async function writeSyncState(entries: Record<string, SyncStateEntry>) {
  await writeEncryptedRecord<SyncStateRecord>(SYNC_STATE_RECORD_TYPE, SYNC_STATE_RECORD_ID, {
    version: 1,
    entries,
  })
}

async function writeRemoteRecord(
  userId: string,
  vaultKey: CryptoKey,
  record: StoredEncryptedSnapshotRecord,
  existing: RemoteSyncRow | null,
): Promise<RemoteSyncRow> {
  const client = getOnlineDataClient()
  const recordKey = existing?.record_key ?? newOpaqueRecordKey()
  const ciphertext = await encryptRecordForSync(vaultKey, record, recordKey)

  const query = existing === null
    ? client
        .from('sync_records')
        .insert({
          user_id: userId,
          record_key: recordKey,
          ciphertext,
          version: 1,
          deleted: false,
        })
        .select('record_key, ciphertext, version, deleted')
        .single()
    : client
        .from('sync_records')
        .update({
          ciphertext,
          version: existing.version + 1,
          deleted: false,
        })
        .eq('user_id', userId)
        .eq('record_key', existing.record_key)
        .eq('version', existing.version)
        .select('record_key, ciphertext, version, deleted')
        .single()

  const { data, error } = await query
  if (error) {
    throw new Error(`No se pudo guardar un cambio cifrado remoto: ${error.message}`)
  }
  return requireRemoteRow(data)
}

async function deleteRemoteRecord(userId: string, existing: RemoteSyncRow): Promise<RemoteSyncRow> {
  const client = getOnlineDataClient()
  const { data, error } = await client
    .from('sync_records')
    .update({
      ciphertext: null,
      version: existing.version + 1,
      deleted: true,
    })
    .eq('user_id', userId)
    .eq('record_key', existing.record_key)
    .eq('version', existing.version)
    .select('record_key, ciphertext, version, deleted')
    .single()

  if (error) {
    throw new Error(`No se pudo guardar una eliminación cifrada remota: ${error.message}`)
  }
  return requireRemoteRow(data)
}

export async function ensureRemoteVaultBootstrap(): Promise<void> {
  const session = await getOnlineAccountSession()
  if (!session) return

  const metadata = await readVaultMetadata()
  if (!metadata || metadata.protection === 'pending') {
    throw new Error('La bóveda local todavía no está lista para sincronizarse.')
  }

  const bootstrap: RemoteVaultBootstrap = {
    protocol: VAULT_BOOTSTRAP_PROTOCOL,
    metadata,
  }
  const ciphertext = JSON.stringify(bootstrap)
  const existing = await fetchRemoteBootstrapRow(session.userId)
  const client = getOnlineDataClient()

  if (!existing) {
    const { error } = await client.from('sync_records').insert({
      user_id: session.userId,
      record_key: VAULT_BOOTSTRAP_KEY,
      ciphertext,
      version: 1,
      deleted: false,
    })
    if (error) throw new Error(`No se pudo vincular la bóveda con la cuenta: ${error.message}`)
    return
  }

  if (!existing.deleted) {
    const remote = parseRemoteVaultBootstrap(existing.ciphertext)
    if (JSON.stringify(remote.metadata.protection) !== JSON.stringify(metadata.protection)) {
      throw new Error('Esta cuenta ya está vinculada a otra clave de bóveda. OANIX no mezclará ambas bóvedas automáticamente.')
    }
    return
  }

  const { error } = await client
    .from('sync_records')
    .update({ ciphertext, version: existing.version + 1, deleted: false })
    .eq('user_id', session.userId)
    .eq('record_key', VAULT_BOOTSTRAP_KEY)
    .eq('version', existing.version)
  if (error) throw new Error(`No se pudo volver a vincular la bóveda: ${error.message}`)
}

export async function hasRemoteSyncedVault(): Promise<boolean> {
  const session = await getOnlineAccountSession()
  if (!session) return false
  const row = await fetchRemoteBootstrapRow(session.userId)
  return Boolean(row && !row.deleted && parseRemoteVaultBootstrap(row.ciphertext))
}

export async function restoreSyncedVaultToThisDevice(
  masterPassword: string,
): Promise<RestoreSyncedVaultResult> {
  const session = await getOnlineAccountSession()
  if (!session) {
    throw new Error('Inicia sesión con la misma cuenta que usas en tu otro dispositivo.')
  }

  const bootstrapRow = await fetchRemoteBootstrapRow(session.userId)
  if (!bootstrapRow || bootstrapRow.deleted) {
    throw new Error('Esta cuenta todavía no tiene una bóveda sincronizada disponible.')
  }
  const bootstrap = parseRemoteVaultBootstrap(bootstrapRow.ciphertext)

  let vaultKey: CryptoKey
  try {
    vaultKey = await openVaultProtection(masterPassword, bootstrap.metadata.protection)
  } catch {
    throw new Error('La contraseña maestra no abre la bóveda sincronizada.')
  }

  const rows = await fetchAllRemoteRows(session.userId)
  const records: StoredEncryptedSnapshotRecord[] = []
  const entries: Record<string, SyncStateEntry> = {}
  const seenLocalKeys = new Set<string>()
  let skippedDeleted = 0

  for (const row of rows) {
    if (row.record_key === VAULT_BOOTSTRAP_KEY) continue
    if (row.deleted) {
      skippedDeleted += 1
      continue
    }

    const envelope = await decryptRemoteEnvelope(vaultKey, row)
    const eligibility = isEligibleLocalKey(envelope.localKey)
    if (!eligibility.eligible) continue
    if (seenLocalKeys.has(envelope.localKey)) {
      throw new Error('La cuenta contiene dos copias cifradas del mismo registro.')
    }
    seenLocalKeys.add(envelope.localKey)
    records.push({ key: envelope.localKey, payload: envelope.payload })
    entries[envelope.localKey] = {
      remoteKey: row.record_key,
      version: row.version,
      fingerprint: await payloadFingerprint(envelope.payload),
      deleted: false,
    }
  }

  await replaceLocalVaultSnapshot({ metadata: bootstrap.metadata, records })
  setActiveVaultKey(vaultKey)
  await writeSyncState(entries)

  return { recordCount: records.length, skippedDeleted }
}

export async function syncEncryptedVaultBidirectional(): Promise<BidirectionalSyncResult> {
  const session = await getOnlineAccountSession()
  if (!session) {
    return {
      uploaded: 0,
      downloaded: 0,
      deletedRemote: 0,
      deletedLocal: 0,
      unchanged: 0,
      conflicts: 0,
      skippedBinary: 0,
    }
  }

  await ensureRemoteVaultBootstrap()
  const vaultKey = requireActiveVaultKey()
  const [{ records, skippedBinary }, state, remoteRows] = await Promise.all([
    readEligibleLocalRecords(),
    readSyncState(),
    fetchAllRemoteRows(session.userId),
  ])

  const localByKey = new Map(records.map((record) => [record.key, record]))
  const remoteByKey = new Map<string, RemoteSyncRow>()
  const remoteActiveByLocalKey = new Map<string, ExistingRemoteRecord>()
  const remoteEnvelopeByKey = new Map<string, SyncEnvelope>()

  for (const row of remoteRows) {
    if (row.record_key === VAULT_BOOTSTRAP_KEY) continue
    remoteByKey.set(row.record_key, row)
    if (row.deleted) continue

    let envelope: SyncEnvelope
    try {
      envelope = await decryptRemoteEnvelope(vaultKey, row)
    } catch {
      throw new Error('La cuenta contiene datos E2EE que esta bóveda no puede descifrar. OANIX no sobrescribirá nada.')
    }

    const eligibility = isEligibleLocalKey(envelope.localKey)
    if (!eligibility.eligible) continue
    if (remoteActiveByLocalKey.has(envelope.localKey)) {
      throw new Error('La cuenta contiene dos sobres E2EE activos para el mismo registro local.')
    }
    remoteActiveByLocalKey.set(envelope.localKey, { row, envelope })
    remoteEnvelopeByKey.set(row.record_key, envelope)
  }

  const allLocalKeys = new Set<string>([
    ...localByKey.keys(),
    ...remoteActiveByLocalKey.keys(),
    ...Object.keys(state.entries),
  ])
  const nextEntries: Record<string, SyncStateEntry> = { ...state.entries }
  const localUpserts: StoredEncryptedSnapshotRecord[] = []
  const localDeletes: string[] = []

  let uploaded = 0
  let downloaded = 0
  let deletedRemote = 0
  let deletedLocal = 0
  let unchanged = 0
  let conflicts = 0

  for (const localKey of allLocalKeys) {
    const local = localByKey.get(localKey) ?? null
    const baseline = state.entries[localKey]
    const activeRemote = remoteActiveByLocalKey.get(localKey) ?? null

    if (!baseline) {
      if (activeRemote) {
        const remoteFingerprint = await payloadFingerprint(activeRemote.envelope.payload)
        if (!local) {
          localUpserts.push({ key: localKey, payload: activeRemote.envelope.payload })
          downloaded += 1
          nextEntries[localKey] = {
            remoteKey: activeRemote.row.record_key,
            version: activeRemote.row.version,
            fingerprint: remoteFingerprint,
            deleted: false,
          }
          continue
        }

        const localFingerprint = await payloadFingerprint(local.payload)
        if (localFingerprint !== remoteFingerprint) {
          conflicts += 1
          continue
        }

        unchanged += 1
        nextEntries[localKey] = {
          remoteKey: activeRemote.row.record_key,
          version: activeRemote.row.version,
          fingerprint: localFingerprint,
          deleted: false,
        }
        continue
      }

      if (local) {
        const row = await writeRemoteRecord(session.userId, vaultKey, local, null)
        const fingerprint = await payloadFingerprint(local.payload)
        uploaded += 1
        nextEntries[localKey] = {
          remoteKey: row.record_key,
          version: row.version,
          fingerprint,
          deleted: false,
        }
      }
      continue
    }

    const remote = remoteByKey.get(baseline.remoteKey)
    if (!remote) {
      conflicts += 1
      continue
    }

    if (activeRemote && activeRemote.row.record_key !== baseline.remoteKey) {
      conflicts += 1
      continue
    }

    if (remote.deleted) {
      if (!local) {
        unchanged += 1
        nextEntries[localKey] = { ...baseline, version: remote.version, deleted: true }
        continue
      }

      const localFingerprint = await payloadFingerprint(local.payload)
      if (!baseline.deleted && localFingerprint === baseline.fingerprint) {
        localDeletes.push(localKey)
        deletedLocal += 1
        nextEntries[localKey] = { ...baseline, version: remote.version, deleted: true }
        continue
      }

      if (baseline.deleted) {
        const row = await writeRemoteRecord(session.userId, vaultKey, local, remote)
        uploaded += 1
        nextEntries[localKey] = {
          remoteKey: row.record_key,
          version: row.version,
          fingerprint: localFingerprint,
          deleted: false,
        }
        continue
      }

      conflicts += 1
      continue
    }

    const remoteEnvelope = remoteEnvelopeByKey.get(remote.record_key)
    if (!remoteEnvelope || remoteEnvelope.localKey !== localKey) {
      conflicts += 1
      continue
    }
    const remoteFingerprint = await payloadFingerprint(remoteEnvelope.payload)

    if (!local) {
      if (baseline.deleted) {
        localUpserts.push({ key: localKey, payload: remoteEnvelope.payload })
        downloaded += 1
        nextEntries[localKey] = {
          remoteKey: remote.record_key,
          version: remote.version,
          fingerprint: remoteFingerprint,
          deleted: false,
        }
        continue
      }

      const remoteChanged = remoteFingerprint !== baseline.fingerprint
      if (remoteChanged) {
        conflicts += 1
        continue
      }

      const deletedRow = await deleteRemoteRecord(session.userId, remote)
      deletedRemote += 1
      nextEntries[localKey] = {
        ...baseline,
        version: deletedRow.version,
        deleted: true,
      }
      continue
    }

    const localFingerprint = await payloadFingerprint(local.payload)
    if (baseline.deleted) {
      if (localFingerprint !== remoteFingerprint) {
        conflicts += 1
        continue
      }
      unchanged += 1
      nextEntries[localKey] = {
        remoteKey: remote.record_key,
        version: remote.version,
        fingerprint: localFingerprint,
        deleted: false,
      }
      continue
    }

    const localChanged = localFingerprint !== baseline.fingerprint
    const remoteChanged = remoteFingerprint !== baseline.fingerprint

    if (localChanged && remoteChanged) {
      if (localFingerprint === remoteFingerprint) {
        unchanged += 1
        nextEntries[localKey] = {
          remoteKey: remote.record_key,
          version: remote.version,
          fingerprint: localFingerprint,
          deleted: false,
        }
      } else {
        conflicts += 1
      }
      continue
    }

    if (localChanged) {
      const row = await writeRemoteRecord(session.userId, vaultKey, local, remote)
      uploaded += 1
      nextEntries[localKey] = {
        remoteKey: row.record_key,
        version: row.version,
        fingerprint: localFingerprint,
        deleted: false,
      }
      continue
    }

    if (remoteChanged) {
      localUpserts.push({ key: localKey, payload: remoteEnvelope.payload })
      downloaded += 1
      nextEntries[localKey] = {
        remoteKey: remote.record_key,
        version: remote.version,
        fingerprint: remoteFingerprint,
        deleted: false,
      }
      continue
    }

    unchanged += 1
    nextEntries[localKey] = {
      ...baseline,
      version: remote.version,
      deleted: false,
    }
  }

  await applyStoredEncryptedRecordChanges(localUpserts, localDeletes)
  await writeSyncState(nextEntries)

  return {
    uploaded,
    downloaded,
    deletedRemote,
    deletedLocal,
    unchanged,
    conflicts,
    skippedBinary,
  }
}

export async function sendEncryptedVaultRecords(): Promise<EncryptedSyncResult> {
  const result = await syncEncryptedVaultBidirectional()
  return {
    uploaded: result.uploaded,
    verified: result.uploaded + result.unchanged,
    unchanged: result.unchanged,
    skippedBinary: result.skippedBinary,
  }
}
