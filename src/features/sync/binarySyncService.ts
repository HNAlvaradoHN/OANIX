import {
  decryptVaultJson,
  encryptVaultJson,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import {
  readEncryptedRecord,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'
import {
  applyStoredEncryptedRecordChanges,
  readStoredEncryptedRecordsMatching,
  type StoredEncryptedSnapshotRecord,
} from '../../storage/repositories/vaultSnapshotRepository'
import { getOnlineAccountSession, getOnlineDataClient } from '../account/accountService'

const STORAGE_BUCKET = 'oanix-encrypted-blobs'
const CHUNK_BYTES = 8 * 1024 * 1024
const MAX_ENCRYPTED_BINARY_BYTES = 50 * 1024 * 1024 + 64
const SYNC_ENVELOPE_PROTOCOL = 'oanix-sync-envelope-v1' as const
const SYNC_ENVELOPE_RECORD_TYPE = 'sync-envelope'
const BINARY_MARKER_PREFIX = 'binary-v1:'
const BINARY_MANIFEST_PROTOCOL = 'oanix-binary-manifest-v1' as const
const BINARY_MANIFEST_RECORD_TYPE = 'sync-binary-manifest'
const BINARY_STATE_RECORD_TYPE = 'system.sync-state'
const BINARY_STATE_RECORD_ID = 'binary'
const VAULT_BOOTSTRAP_KEY = 'vault-bootstrap-v1'
const BINARY_TYPES = new Set(['image', 'image-preview'])

interface OuterSyncEnvelope {
  protocol: typeof SYNC_ENVELOPE_PROTOCOL
  localKey: string
  payload: EncryptedVaultPayload
}

interface BinaryManifest {
  protocol: typeof BINARY_MANIFEST_PROTOCOL
  localKey: string
  scheme: 'aes-gcm-v1'
  iv: string
  objectPrefix: string
  chunkCount: number
  chunkSize: number
  ciphertextByteLength: number
  ciphertextSha256: string
}

interface RemoteSyncRow {
  record_key: string
  ciphertext: string | null
  version: number
  deleted: boolean
}

interface RemoteBinaryRecord {
  row: RemoteSyncRow
  marker: string
  manifest: BinaryManifest
}

interface BinaryStateEntry {
  remoteKey: string
  version: number
  fingerprint: string
  deleted: boolean
}

interface BinarySyncState {
  version: 1
  entries: Record<string, BinaryStateEntry>
  cleanupPaths: string[]
}

export interface BinarySyncResult {
  uploaded: number
  downloaded: number
  deletedRemote: number
  deletedLocal: number
  unchanged: number
  conflicts: number
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

function parseBinaryLocalKey(key: string): { recordType: string; recordId: string } | null {
  try {
    const value = JSON.parse(key)
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === 'string' &&
      BINARY_TYPES.has(value[0]) &&
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

function requireRemoteRow(value: unknown): RemoteSyncRow {
  if (!value || typeof value !== 'object') {
    throw new Error('Supabase devolvió un registro binario inválido.')
  }
  const row = value as Partial<RemoteSyncRow>
  const validCiphertext = row.deleted === true
    ? row.ciphertext === null
    : typeof row.ciphertext === 'string' && row.ciphertext.length > 0

  if (
    typeof row.record_key !== 'string' || row.record_key.length === 0 ||
    typeof row.version !== 'number' || !Number.isSafeInteger(row.version) || row.version <= 0 ||
    typeof row.deleted !== 'boolean' || !validCiphertext
  ) {
    throw new Error('Supabase devolvió metadatos binarios inválidos.')
  }
  return row as RemoteSyncRow
}

function requireOuterEnvelope(value: unknown): OuterSyncEnvelope {
  if (!value || typeof value !== 'object') {
    throw new Error('El sobre E2EE remoto es inválido.')
  }
  const candidate = value as Partial<OuterSyncEnvelope>
  if (
    candidate.protocol !== SYNC_ENVELOPE_PROTOCOL ||
    typeof candidate.localKey !== 'string' ||
    candidate.localKey.length === 0 ||
    !isEncryptedVaultPayload(candidate.payload)
  ) {
    throw new Error('El sobre E2EE remoto no es compatible.')
  }
  return candidate as OuterSyncEnvelope
}

function requireBinaryManifest(value: unknown): BinaryManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('El manifiesto cifrado de imagen es inválido.')
  }
  const candidate = value as Partial<BinaryManifest>
  if (
    candidate.protocol !== BINARY_MANIFEST_PROTOCOL ||
    typeof candidate.localKey !== 'string' ||
    !parseBinaryLocalKey(candidate.localKey) ||
    candidate.scheme !== 'aes-gcm-v1' ||
    typeof candidate.iv !== 'string' || candidate.iv.length === 0 ||
    typeof candidate.objectPrefix !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(candidate.objectPrefix) ||
    typeof candidate.chunkCount !== 'number' || !Number.isSafeInteger(candidate.chunkCount) || candidate.chunkCount < 1 || candidate.chunkCount > 64 ||
    candidate.chunkSize !== CHUNK_BYTES ||
    typeof candidate.ciphertextByteLength !== 'number' || !Number.isSafeInteger(candidate.ciphertextByteLength) ||
    candidate.ciphertextByteLength < 1 || candidate.ciphertextByteLength > MAX_ENCRYPTED_BINARY_BYTES ||
    typeof candidate.ciphertextSha256 !== 'string' || candidate.ciphertextSha256.length < 20
  ) {
    throw new Error('El manifiesto cifrado de imagen contiene datos inválidos.')
  }
  return candidate as BinaryManifest
}

function newOpaqueId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('No hay un generador aleatorio seguro para sincronizar imágenes.')
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  const partSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += partSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + partSize, bytes.length)))
  }
  return btoa(binary)
}

async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto no está disponible para verificar imágenes sincronizadas.')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  return bytesToBase64(new Uint8Array(digest))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function localBinaryFingerprint(payload: EncryptedVaultPayload): Promise<string> {
  const bytes = base64ToBytes(payload.ciphertext)
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_ENCRYPTED_BINARY_BYTES) {
    throw new Error('Una imagen cifrada local supera el límite seguro de sincronización.')
  }
  const hash = await sha256Base64Url(bytes)
  return `${payload.scheme}:${payload.iv}:${bytes.byteLength}:${hash}`
}

function manifestFingerprint(manifest: BinaryManifest): string {
  return `${manifest.scheme}:${manifest.iv}:${manifest.ciphertextByteLength}:${manifest.ciphertextSha256}`
}

function objectPaths(userId: string, manifest: BinaryManifest): string[] {
  return Array.from({ length: manifest.chunkCount }, (_, index) => (
    `${userId}/${manifest.objectPrefix}/${String(index).padStart(6, '0')}.bin`
  ))
}

async function readBinaryState(): Promise<BinarySyncState> {
  const value = await readEncryptedRecord<unknown>(BINARY_STATE_RECORD_TYPE, BINARY_STATE_RECORD_ID)
  if (value === null) return { version: 1, entries: {}, cleanupPaths: [] }
  if (!value || typeof value !== 'object') throw new Error('El estado cifrado de imágenes está dañado.')

  const candidate = value as Partial<BinarySyncState>
  if (candidate.version !== 1 || !candidate.entries || typeof candidate.entries !== 'object' || !Array.isArray(candidate.cleanupPaths)) {
    throw new Error('El estado cifrado de imágenes no es compatible.')
  }

  for (const [localKey, entry] of Object.entries(candidate.entries)) {
    if (
      !parseBinaryLocalKey(localKey) ||
      !entry || typeof entry.remoteKey !== 'string' || entry.remoteKey.length === 0 ||
      typeof entry.version !== 'number' || !Number.isSafeInteger(entry.version) || entry.version <= 0 ||
      typeof entry.fingerprint !== 'string' ||
      typeof entry.deleted !== 'boolean'
    ) {
      throw new Error('El estado cifrado de imágenes contiene una entrada inválida.')
    }
  }
  if (candidate.cleanupPaths.some((path) => typeof path !== 'string' || path.length < 1)) {
    throw new Error('La cola cifrada de limpieza de imágenes es inválida.')
  }
  return candidate as BinarySyncState
}

async function writeBinaryState(state: BinarySyncState) {
  state.cleanupPaths = Array.from(new Set(state.cleanupPaths))
  await writeEncryptedRecord(BINARY_STATE_RECORD_TYPE, BINARY_STATE_RECORD_ID, state)
}

async function flushCleanupQueue(state: BinarySyncState) {
  if (state.cleanupPaths.length === 0) return
  const client = getOnlineDataClient()
  const { error } = await client.storage.from(STORAGE_BUCKET).remove(state.cleanupPaths)
  if (error) return
  state.cleanupPaths = []
  await writeBinaryState(state)
}

async function queueCleanup(state: BinarySyncState, paths: string[]) {
  if (paths.length === 0) return
  state.cleanupPaths = Array.from(new Set([...state.cleanupPaths, ...paths]))
  await writeBinaryState(state)
  await flushCleanupQueue(state)
}

async function fetchRemoteRows(userId: string): Promise<RemoteSyncRow[]> {
  const client = getOnlineDataClient()
  const { data, error } = await client
    .from('sync_records')
    .select('record_key, ciphertext, version, deleted')
    .eq('user_id', userId)
  if (error) throw new Error(`No se pudieron consultar las imágenes cifradas remotas: ${error.message}`)
  return (data ?? []).map(requireRemoteRow)
}

async function decryptBinaryRemote(
  vaultKey: CryptoKey,
  row: RemoteSyncRow,
): Promise<RemoteBinaryRecord | null> {
  if (row.deleted || row.ciphertext === null || row.record_key === VAULT_BOOTSTRAP_KEY) return null

  let encryptedOuter: unknown
  try {
    encryptedOuter = JSON.parse(row.ciphertext)
  } catch {
    return null
  }
  if (!isEncryptedVaultPayload(encryptedOuter)) return null

  const outerValue = await decryptVaultJson<unknown>(vaultKey, encryptedOuter, {
    recordType: SYNC_ENVELOPE_RECORD_TYPE,
    recordId: row.record_key,
  })
  const outer = requireOuterEnvelope(outerValue)
  if (!outer.localKey.startsWith(BINARY_MARKER_PREFIX)) return null

  const manifestValue = await decryptVaultJson<unknown>(vaultKey, outer.payload, {
    recordType: BINARY_MANIFEST_RECORD_TYPE,
    recordId: outer.localKey,
  })
  return {
    row,
    marker: outer.localKey,
    manifest: requireBinaryManifest(manifestValue),
  }
}

async function encryptBinaryRow(
  vaultKey: CryptoKey,
  remoteKey: string,
  marker: string,
  manifest: BinaryManifest,
): Promise<string> {
  const encryptedManifest = await encryptVaultJson(vaultKey, manifest, {
    recordType: BINARY_MANIFEST_RECORD_TYPE,
    recordId: marker,
  })
  const outer: OuterSyncEnvelope = {
    protocol: SYNC_ENVELOPE_PROTOCOL,
    localKey: marker,
    payload: encryptedManifest,
  }
  const encryptedOuter = await encryptVaultJson(vaultKey, outer, {
    recordType: SYNC_ENVELOPE_RECORD_TYPE,
    recordId: remoteKey,
  })
  return JSON.stringify(encryptedOuter)
}

async function uploadBinaryChunks(
  userId: string,
  localKey: string,
  payload: EncryptedVaultPayload,
): Promise<{ manifest: BinaryManifest; paths: string[] }> {
  const bytes = base64ToBytes(payload.ciphertext)
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_ENCRYPTED_BINARY_BYTES) {
    throw new Error('Una imagen cifrada supera el límite permitido para sincronizarse.')
  }

  const objectPrefix = newOpaqueId()
  const chunkCount = Math.ceil(bytes.byteLength / CHUNK_BYTES)
  const hash = await sha256Base64Url(bytes)
  const manifest: BinaryManifest = {
    protocol: BINARY_MANIFEST_PROTOCOL,
    localKey,
    scheme: payload.scheme,
    iv: payload.iv,
    objectPrefix,
    chunkCount,
    chunkSize: CHUNK_BYTES,
    ciphertextByteLength: bytes.byteLength,
    ciphertextSha256: hash,
  }
  const paths = objectPaths(userId, manifest)
  const uploadedPaths: string[] = []
  const storage = getOnlineDataClient().storage.from(STORAGE_BUCKET)

  try {
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * CHUNK_BYTES
      const end = Math.min(start + CHUNK_BYTES, bytes.byteLength)
      const body = new Blob([Uint8Array.from(bytes.subarray(start, end))], { type: 'application/octet-stream' })
      const { error } = await storage.upload(paths[index], body, {
        contentType: 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw new Error(error.message)
      uploadedPaths.push(paths[index])
    }
  } catch (error) {
    if (uploadedPaths.length > 0) await storage.remove(uploadedPaths)
    throw new Error(`No se pudieron subir los fragmentos cifrados de una imagen: ${error instanceof Error ? error.message : String(error)}`)
  }

  return { manifest, paths }
}

async function downloadBinaryPayload(
  userId: string,
  manifest: BinaryManifest,
): Promise<EncryptedVaultPayload> {
  const storage = getOnlineDataClient().storage.from(STORAGE_BUCKET)
  const paths = objectPaths(userId, manifest)
  const chunks: Uint8Array[] = []
  let total = 0

  for (const path of paths) {
    const { data, error } = await storage.download(path)
    if (error || !data) {
      throw new Error(`No se pudo descargar un fragmento cifrado de imagen: ${error?.message ?? 'respuesta vacía'}`)
    }
    const chunk = new Uint8Array(await data.arrayBuffer())
    total += chunk.byteLength
    if (total > manifest.ciphertextByteLength) {
      throw new Error('Los fragmentos cifrados de imagen exceden el tamaño esperado.')
    }
    chunks.push(chunk)
  }

  if (total !== manifest.ciphertextByteLength) {
    throw new Error('La imagen cifrada descargada está incompleta.')
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  const hash = await sha256Base64Url(bytes)
  if (hash !== manifest.ciphertextSha256) {
    throw new Error('La verificación de integridad de la imagen cifrada no coincide.')
  }

  return {
    scheme: manifest.scheme,
    iv: manifest.iv,
    ciphertext: bytesToBase64(bytes),
  }
}

async function insertOrUpdateBinaryRemote(
  userId: string,
  vaultKey: CryptoKey,
  local: StoredEncryptedSnapshotRecord,
  existing: RemoteBinaryRecord | null,
  state: BinarySyncState,
): Promise<RemoteBinaryRecord> {
  const remoteKey = existing?.row.record_key ?? newOpaqueId()
  const marker = existing?.marker ?? `${BINARY_MARKER_PREFIX}${newOpaqueId()}`
  const uploaded = await uploadBinaryChunks(userId, local.key, local.payload)
  const ciphertext = await encryptBinaryRow(vaultKey, remoteKey, marker, uploaded.manifest)
  const client = getOnlineDataClient()

  const query = existing
    ? client
        .from('sync_records')
        .update({ ciphertext, version: existing.row.version + 1, deleted: false })
        .eq('user_id', userId)
        .eq('record_key', remoteKey)
        .eq('version', existing.row.version)
        .select('record_key, ciphertext, version, deleted')
        .single()
    : client
        .from('sync_records')
        .insert({ user_id: userId, record_key: remoteKey, ciphertext, version: 1, deleted: false })
        .select('record_key, ciphertext, version, deleted')
        .single()

  const { data, error } = await query
  if (error) {
    state.cleanupPaths = Array.from(new Set([...state.cleanupPaths, ...uploaded.paths]))
    await writeBinaryState(state)
    await flushCleanupQueue(state)
    throw new Error(`No se pudo publicar el manifiesto cifrado de una imagen: ${error.message}`)
  }

  const row = requireRemoteRow(data)
  if (existing) await queueCleanup(state, objectPaths(userId, existing.manifest))
  return { row, marker, manifest: uploaded.manifest }
}

async function tombstoneBinaryRemote(
  userId: string,
  existing: RemoteBinaryRecord,
  state: BinarySyncState,
): Promise<RemoteSyncRow> {
  const client = getOnlineDataClient()
  const { data, error } = await client
    .from('sync_records')
    .update({ ciphertext: null, version: existing.row.version + 1, deleted: true })
    .eq('user_id', userId)
    .eq('record_key', existing.row.record_key)
    .eq('version', existing.row.version)
    .select('record_key, ciphertext, version, deleted')
    .single()

  if (error) throw new Error(`No se pudo guardar la eliminación cifrada de una imagen: ${error.message}`)
  const row = requireRemoteRow(data)
  await queueCleanup(state, objectPaths(userId, existing.manifest))
  return row
}

export async function syncEncryptedBinariesBidirectional(): Promise<BinarySyncResult> {
  const session = await getOnlineAccountSession()
  if (!session) {
    return { uploaded: 0, downloaded: 0, deletedRemote: 0, deletedLocal: 0, unchanged: 0, conflicts: 0 }
  }

  const vaultKey = requireActiveVaultKey()
  const state = await readBinaryState()
  await flushCleanupQueue(state)

  const localRecords = await readStoredEncryptedRecordsMatching((key) => Boolean(parseBinaryLocalKey(key)))
  const localByKey = new Map(localRecords.map((record) => [record.key, record]))
  const localFingerprintCache = new Map<string, string>()
  const getLocalFingerprint = async (record: StoredEncryptedSnapshotRecord) => {
    const cached = localFingerprintCache.get(record.key)
    if (cached) return cached
    const fingerprint = await localBinaryFingerprint(record.payload)
    localFingerprintCache.set(record.key, fingerprint)
    return fingerprint
  }

  const rows = await fetchRemoteRows(session.userId)
  const remoteByKey = new Map(rows.map((row) => [row.record_key, row]))
  const remoteActiveByLocalKey = new Map<string, RemoteBinaryRecord>()

  for (const row of rows) {
    if (row.deleted || row.record_key === VAULT_BOOTSTRAP_KEY) continue
    let binary: RemoteBinaryRecord | null
    try {
      binary = await decryptBinaryRemote(vaultKey, row)
    } catch {
      throw new Error('La cuenta contiene un manifiesto E2EE que esta bóveda no puede validar. OANIX no sobrescribirá imágenes.')
    }
    if (!binary) continue
    if (remoteActiveByLocalKey.has(binary.manifest.localKey)) {
      throw new Error('La cuenta contiene dos manifiestos activos para la misma imagen cifrada.')
    }
    remoteActiveByLocalKey.set(binary.manifest.localKey, binary)
  }

  const allKeys = new Set([
    ...localByKey.keys(),
    ...remoteActiveByLocalKey.keys(),
    ...Object.keys(state.entries),
  ])

  let uploaded = 0
  let downloaded = 0
  let deletedRemote = 0
  let deletedLocal = 0
  let unchanged = 0
  let conflicts = 0

  for (const localKey of allKeys) {
    const local = localByKey.get(localKey) ?? null
    const baseline = state.entries[localKey]
    const activeRemote = remoteActiveByLocalKey.get(localKey) ?? null

    if (!baseline) {
      if (activeRemote) {
        const remoteFingerprint = manifestFingerprint(activeRemote.manifest)
        if (!local) {
          const payload = await downloadBinaryPayload(session.userId, activeRemote.manifest)
          await applyStoredEncryptedRecordChanges([{ key: localKey, payload }], [])
          downloaded += 1
          state.entries[localKey] = {
            remoteKey: activeRemote.row.record_key,
            version: activeRemote.row.version,
            fingerprint: remoteFingerprint,
            deleted: false,
          }
          continue
        }

        const localFingerprint = await getLocalFingerprint(local)
        if (localFingerprint !== remoteFingerprint) {
          conflicts += 1
          continue
        }
        unchanged += 1
        state.entries[localKey] = {
          remoteKey: activeRemote.row.record_key,
          version: activeRemote.row.version,
          fingerprint: localFingerprint,
          deleted: false,
        }
        continue
      }

      if (local) {
        const remote = await insertOrUpdateBinaryRemote(session.userId, vaultKey, local, null, state)
        const fingerprint = await getLocalFingerprint(local)
        uploaded += 1
        state.entries[localKey] = {
          remoteKey: remote.row.record_key,
          version: remote.row.version,
          fingerprint,
          deleted: false,
        }
      }
      continue
    }

    const remoteRow = remoteByKey.get(baseline.remoteKey)
    if (!remoteRow) {
      conflicts += 1
      continue
    }

    if (remoteRow.deleted) {
      if (!local) {
        unchanged += 1
        state.entries[localKey] = { ...baseline, version: remoteRow.version, deleted: true }
        continue
      }

      const localFingerprint = await getLocalFingerprint(local)
      if (!baseline.deleted && localFingerprint === baseline.fingerprint) {
        await applyStoredEncryptedRecordChanges([], [localKey])
        deletedLocal += 1
        state.entries[localKey] = { ...baseline, version: remoteRow.version, deleted: true }
        continue
      }

      if (baseline.deleted) {
        const remote = await insertOrUpdateBinaryRemote(session.userId, vaultKey, local, null, state)
        uploaded += 1
        state.entries[localKey] = {
          remoteKey: remote.row.record_key,
          version: remote.row.version,
          fingerprint: localFingerprint,
          deleted: false,
        }
        continue
      }

      conflicts += 1
      continue
    }

    const remote = activeRemote
    if (!remote || remote.row.record_key !== baseline.remoteKey) {
      conflicts += 1
      continue
    }
    const remoteFingerprint = manifestFingerprint(remote.manifest)

    if (!local) {
      if (baseline.deleted) {
        const payload = await downloadBinaryPayload(session.userId, remote.manifest)
        await applyStoredEncryptedRecordChanges([{ key: localKey, payload }], [])
        downloaded += 1
        state.entries[localKey] = {
          remoteKey: remote.row.record_key,
          version: remote.row.version,
          fingerprint: remoteFingerprint,
          deleted: false,
        }
        continue
      }

      if (remoteFingerprint !== baseline.fingerprint) {
        conflicts += 1
        continue
      }

      const deleted = await tombstoneBinaryRemote(session.userId, remote, state)
      deletedRemote += 1
      state.entries[localKey] = { ...baseline, version: deleted.version, deleted: true }
      continue
    }

    const localFingerprint = await getLocalFingerprint(local)
    if (baseline.deleted) {
      if (localFingerprint !== remoteFingerprint) {
        conflicts += 1
        continue
      }
      unchanged += 1
      state.entries[localKey] = {
        remoteKey: remote.row.record_key,
        version: remote.row.version,
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
        state.entries[localKey] = {
          remoteKey: remote.row.record_key,
          version: remote.row.version,
          fingerprint: localFingerprint,
          deleted: false,
        }
      } else {
        conflicts += 1
      }
      continue
    }

    if (localChanged) {
      const updated = await insertOrUpdateBinaryRemote(session.userId, vaultKey, local, remote, state)
      uploaded += 1
      state.entries[localKey] = {
        remoteKey: updated.row.record_key,
        version: updated.row.version,
        fingerprint: localFingerprint,
        deleted: false,
      }
      continue
    }

    if (remoteChanged) {
      const payload = await downloadBinaryPayload(session.userId, remote.manifest)
      await applyStoredEncryptedRecordChanges([{ key: localKey, payload }], [])
      downloaded += 1
      state.entries[localKey] = {
        remoteKey: remote.row.record_key,
        version: remote.row.version,
        fingerprint: remoteFingerprint,
        deleted: false,
      }
      continue
    }

    unchanged += 1
    state.entries[localKey] = {
      ...baseline,
      version: remote.row.version,
      deleted: false,
    }
  }

  await writeBinaryState(state)
  await flushCleanupQueue(state)

  return { uploaded, downloaded, deletedRemote, deletedLocal, unchanged, conflicts }
}
