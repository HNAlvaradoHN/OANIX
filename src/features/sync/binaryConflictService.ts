import {
  decryptVaultBytes,
  decryptVaultJson,
  encryptVaultJson,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import { readEncryptedRecord, writeEncryptedRecord } from '../../storage/repositories/encryptedRecordRepository'
import {
  applyStoredEncryptedRecordChanges,
  readStoredEncryptedRecordsMatching,
  type StoredEncryptedSnapshotRecord,
} from '../../storage/repositories/vaultSnapshotRepository'
import { getOnlineAccountSession, getOnlineDataClient } from '../account/accountService'
import type { SyncConflictResolutionChoice, SyncConflictView } from './conflictService'

const STORAGE_BUCKET = 'oanix-encrypted-blobs'
const CHUNK_BYTES = 6 * 1024 * 1024
const BASE64_CHARS_PER_CHUNK = (CHUNK_BYTES / 3) * 4
const MAX_ENCRYPTED_BINARY_BYTES = 50 * 1024 * 1024 + 64
const ENVELOPE_PROTOCOL = 'oanix-sync-envelope-v1' as const
const ENVELOPE_RECORD_TYPE = 'sync-envelope'
const BINARY_MARKER_PREFIX = 'binary-v1:'
const MANIFEST_PROTOCOL = 'oanix-binary-manifest-v1' as const
const MANIFEST_RECORD_TYPE = 'sync-binary-manifest'
const STATE_RECORD_TYPE = 'system.sync-state'
const STATE_RECORD_ID = 'binary'
const BOOTSTRAP_KEY = 'vault-bootstrap-v1'
const IMAGE_TYPE = 'image'
const PREVIEW_TYPE = 'image-preview'

interface OuterEnvelope {
  protocol: typeof ENVELOPE_PROTOCOL
  localKey: string
  payload: EncryptedVaultPayload
}

interface BinaryManifest {
  protocol: typeof MANIFEST_PROTOCOL
  localKey: string
  scheme: 'aes-gcm-v1'
  iv: string
  objectPrefix: string
  chunkCount: number
  chunkSize: number
  ciphertextByteLength: number
  chunkSha256: string[]
}

interface RemoteRow {
  record_key: string
  ciphertext: string | null
  version: number
  deleted: boolean
}

interface RemoteBinary {
  row: RemoteRow
  marker: string
  manifest: BinaryManifest
}

interface StateEntry {
  remoteKey: string
  version: number
  fingerprint: string
  deleted: boolean
}

interface BinaryState {
  version: 1
  entries: Record<string, StateEntry>
  cleanupPaths: string[]
}

interface Inspection {
  fingerprint: string
  byteLength: number
  chunkHashes: string[]
}

interface InternalConflict {
  localKey: string
  recordId: string
  remoteKey: string
  remoteVersion: number
  localDeleted: boolean
  remoteDeleted: boolean
  localPayload: EncryptedVaultPayload | null
  remote: RemoteBinary | null
  localFingerprint: string
  remoteFingerprint: string
  token: string
  resolvable: boolean
  reason: string
}

export interface BinaryImageConflictSide {
  kind: 'binary-image'
  encryptedByteLength: number
}

export interface BinaryImageConflictVisuals {
  local: Blob | null
  remote: Blob | null
}

function keyFor(recordType: string, recordId: string) {
  return JSON.stringify([recordType, recordId])
}

function parseBinaryKey(key: string): { recordType: typeof IMAGE_TYPE | typeof PREVIEW_TYPE; recordId: string } | null {
  try {
    const value = JSON.parse(key)
    if (!Array.isArray(value) || value.length !== 2 || typeof value[1] !== 'string' || !value[1]) return null
    if (value[0] !== IMAGE_TYPE && value[0] !== PREVIEW_TYPE) return null
    return { recordType: value[0], recordId: value[1] }
  } catch {
    return null
  }
}

function isPreviewKey(key: string) {
  return parseBinaryKey(key)?.recordType === PREVIEW_TYPE
}

function isPayload(value: unknown): value is EncryptedVaultPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<EncryptedVaultPayload>
  return candidate.scheme === 'aes-gcm-v1'
    && typeof candidate.iv === 'string'
    && candidate.iv.length > 0
    && typeof candidate.ciphertext === 'string'
    && candidate.ciphertext.length > 0
}

function requireRemoteRow(value: unknown): RemoteRow {
  if (!value || typeof value !== 'object') throw new Error('Supabase devolvió un registro binario inválido.')
  const row = value as Partial<RemoteRow>
  const ciphertextOk = row.deleted === true
    ? row.ciphertext === null
    : typeof row.ciphertext === 'string' && row.ciphertext.length > 0
  if (
    typeof row.record_key !== 'string' || !row.record_key
    || typeof row.version !== 'number' || !Number.isSafeInteger(row.version) || row.version <= 0
    || typeof row.deleted !== 'boolean' || !ciphertextOk
  ) throw new Error('Supabase devolvió metadatos binarios inválidos.')
  return row as RemoteRow
}

function requireOuterEnvelope(value: unknown): OuterEnvelope {
  if (!value || typeof value !== 'object') throw new Error('El sobre E2EE remoto es inválido.')
  const envelope = value as Partial<OuterEnvelope>
  if (envelope.protocol !== ENVELOPE_PROTOCOL || typeof envelope.localKey !== 'string' || !isPayload(envelope.payload)) {
    throw new Error('El sobre E2EE remoto no es compatible.')
  }
  return envelope as OuterEnvelope
}

function requireManifest(value: unknown): BinaryManifest {
  if (!value || typeof value !== 'object') throw new Error('El manifiesto cifrado de imagen es inválido.')
  const manifest = value as Partial<BinaryManifest>
  const hashesOk = Array.isArray(manifest.chunkSha256)
    && manifest.chunkSha256.every((hash) => typeof hash === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(hash))
  if (
    manifest.protocol !== MANIFEST_PROTOCOL
    || typeof manifest.localKey !== 'string' || !parseBinaryKey(manifest.localKey)
    || manifest.scheme !== 'aes-gcm-v1'
    || typeof manifest.iv !== 'string' || !manifest.iv
    || typeof manifest.objectPrefix !== 'string' || !/^[A-Za-z0-9-]{16,80}$/.test(manifest.objectPrefix)
    || typeof manifest.chunkCount !== 'number' || !Number.isSafeInteger(manifest.chunkCount) || manifest.chunkCount < 1 || manifest.chunkCount > 64
    || manifest.chunkSize !== CHUNK_BYTES
    || typeof manifest.ciphertextByteLength !== 'number' || !Number.isSafeInteger(manifest.ciphertextByteLength)
    || manifest.ciphertextByteLength < 1 || manifest.ciphertextByteLength > MAX_ENCRYPTED_BINARY_BYTES
    || !hashesOk || manifest.chunkSha256?.length !== manifest.chunkCount
  ) throw new Error('El manifiesto cifrado de imagen contiene datos inválidos.')
  return manifest as BinaryManifest
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)))
  }
  return btoa(binary)
}

function base64DecodedLength(value: string) {
  if (!value || value.length % 4 !== 0) throw new Error('El ciphertext binario local usa un Base64 inválido.')
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  return (value.length / 4) * 3 - padding
}

async function sha256Base64Url(bytes: Uint8Array) {
  if (!crypto?.subtle) throw new Error('Web Crypto no está disponible para verificar imágenes sincronizadas.')
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  return bytesToBase64(new Uint8Array(digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function inspectPayload(payload: EncryptedVaultPayload): Promise<Inspection> {
  const byteLength = base64DecodedLength(payload.ciphertext)
  if (byteLength < 1 || byteLength > MAX_ENCRYPTED_BINARY_BYTES) {
    throw new Error('Una imagen cifrada local supera el límite seguro de sincronización.')
  }
  const chunkHashes: string[] = []
  for (let offset = 0; offset < payload.ciphertext.length; offset += BASE64_CHARS_PER_CHUNK) {
    chunkHashes.push(await sha256Base64Url(decodeBase64(payload.ciphertext.slice(offset, offset + BASE64_CHARS_PER_CHUNK))))
  }
  return {
    fingerprint: `${payload.scheme}:${payload.iv}:${byteLength}:${chunkHashes.join('.')}`,
    byteLength,
    chunkHashes,
  }
}

function manifestFingerprint(manifest: BinaryManifest) {
  return `${manifest.scheme}:${manifest.iv}:${manifest.ciphertextByteLength}:${manifest.chunkSha256.join('.')}`
}

function objectPaths(userId: string, manifest: BinaryManifest) {
  return Array.from({ length: manifest.chunkCount }, (_, index) => (
    `${userId}/${manifest.objectPrefix}/${String(index).padStart(6, '0')}.bin`
  ))
}

async function readState(): Promise<BinaryState> {
  const value = await readEncryptedRecord<unknown>(STATE_RECORD_TYPE, STATE_RECORD_ID)
  if (value === null) return { version: 1, entries: {}, cleanupPaths: [] }
  if (!value || typeof value !== 'object') throw new Error('El estado cifrado de imágenes está dañado.')
  const state = value as Partial<BinaryState>
  if (state.version !== 1 || !state.entries || typeof state.entries !== 'object' || !Array.isArray(state.cleanupPaths)) {
    throw new Error('El estado cifrado de imágenes no es compatible.')
  }
  return state as BinaryState
}

async function writeState(state: BinaryState) {
  state.cleanupPaths = Array.from(new Set(state.cleanupPaths))
  await writeEncryptedRecord(STATE_RECORD_TYPE, STATE_RECORD_ID, state)
}

async function flushCleanup(state: BinaryState) {
  if (state.cleanupPaths.length === 0) return
  const { error } = await getOnlineDataClient().storage.from(STORAGE_BUCKET).remove(state.cleanupPaths)
  if (error) return
  state.cleanupPaths = []
  await writeState(state)
}

async function queueCleanup(state: BinaryState, paths: string[]) {
  if (paths.length === 0) return
  state.cleanupPaths = Array.from(new Set([...state.cleanupPaths, ...paths]))
  await writeState(state)
  await flushCleanup(state)
}

async function fetchRows(userId: string) {
  const { data, error } = await getOnlineDataClient()
    .from('sync_records')
    .select('record_key, ciphertext, version, deleted')
    .eq('user_id', userId)
  if (error) throw new Error(`No se pudieron consultar las imágenes cifradas remotas: ${error.message}`)
  return (data ?? []).map(requireRemoteRow)
}

async function decryptRemote(vaultKey: CryptoKey, row: RemoteRow): Promise<RemoteBinary | null> {
  if (row.deleted || row.ciphertext === null || row.record_key === BOOTSTRAP_KEY) return null
  let outerPayload: unknown
  try { outerPayload = JSON.parse(row.ciphertext) } catch { return null }
  if (!isPayload(outerPayload)) return null
  const outer = requireOuterEnvelope(await decryptVaultJson<unknown>(vaultKey, outerPayload, {
    recordType: ENVELOPE_RECORD_TYPE,
    recordId: row.record_key,
  }))
  if (!outer.localKey.startsWith(BINARY_MARKER_PREFIX)) return null
  const manifest = requireManifest(await decryptVaultJson<unknown>(vaultKey, outer.payload, {
    recordType: MANIFEST_RECORD_TYPE,
    recordId: outer.localKey,
  }))
  return { row, marker: outer.localKey, manifest }
}

async function encryptRemoteRow(vaultKey: CryptoKey, remoteKey: string, marker: string, manifest: BinaryManifest) {
  const encryptedManifest = await encryptVaultJson(vaultKey, manifest, {
    recordType: MANIFEST_RECORD_TYPE,
    recordId: marker,
  })
  const encryptedOuter = await encryptVaultJson<OuterEnvelope>(vaultKey, {
    protocol: ENVELOPE_PROTOCOL,
    localKey: marker,
    payload: encryptedManifest,
  }, {
    recordType: ENVELOPE_RECORD_TYPE,
    recordId: remoteKey,
  })
  return JSON.stringify(encryptedOuter)
}

function opaqueId() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  if (!crypto?.getRandomValues) throw new Error('No hay un generador aleatorio seguro para sincronizar imágenes.')
  return Array.from(crypto.getRandomValues(new Uint8Array(24))).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function uploadChunks(userId: string, localKey: string, payload: EncryptedVaultPayload, inspection: Inspection) {
  const objectPrefix = opaqueId()
  const manifest: BinaryManifest = {
    protocol: MANIFEST_PROTOCOL,
    localKey,
    scheme: payload.scheme,
    iv: payload.iv,
    objectPrefix,
    chunkCount: inspection.chunkHashes.length,
    chunkSize: CHUNK_BYTES,
    ciphertextByteLength: inspection.byteLength,
    chunkSha256: inspection.chunkHashes,
  }
  const paths = objectPaths(userId, manifest)
  const uploaded: string[] = []
  const storage = getOnlineDataClient().storage.from(STORAGE_BUCKET)
  try {
    for (let index = 0; index < paths.length; index += 1) {
      const start = index * BASE64_CHARS_PER_CHUNK
      const chunk = decodeBase64(payload.ciphertext.slice(start, start + BASE64_CHARS_PER_CHUNK))
      const { error } = await storage.upload(paths[index], new Blob([Uint8Array.from(chunk)], { type: 'application/octet-stream' }), {
        contentType: 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw new Error(error.message)
      uploaded.push(paths[index])
    }
  } catch (error) {
    if (uploaded.length > 0) await storage.remove(uploaded)
    throw new Error(`No se pudieron subir los fragmentos cifrados de una imagen: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { manifest, paths }
}

async function downloadPayload(userId: string, manifest: BinaryManifest): Promise<EncryptedVaultPayload> {
  const storage = getOnlineDataClient().storage.from(STORAGE_BUCKET)
  const paths = objectPaths(userId, manifest)
  const parts: string[] = []
  let total = 0
  for (let index = 0; index < paths.length; index += 1) {
    const { data, error } = await storage.download(paths[index])
    if (error || !data) throw new Error(`No se pudo descargar un fragmento cifrado de imagen: ${error?.message ?? 'respuesta vacía'}`)
    const chunk = new Uint8Array(await data.arrayBuffer())
    total += chunk.byteLength
    if (total > manifest.ciphertextByteLength) throw new Error('Los fragmentos cifrados de imagen exceden el tamaño esperado.')
    if (await sha256Base64Url(chunk) !== manifest.chunkSha256[index]) {
      throw new Error('La verificación de integridad de un fragmento cifrado no coincide.')
    }
    parts.push(bytesToBase64(chunk))
  }
  if (total !== manifest.ciphertextByteLength) throw new Error('La imagen cifrada descargada está incompleta.')
  return { scheme: manifest.scheme, iv: manifest.iv, ciphertext: parts.join('') }
}

async function publishLocal(
  userId: string,
  vaultKey: CryptoKey,
  local: StoredEncryptedSnapshotRecord,
  inspection: Inspection,
  current: RemoteBinary | RemoteRow | null,
  state: BinaryState,
) {
  const row = current && 'row' in current ? current.row : current
  const oldBinary = current && 'manifest' in current ? current : null
  const remoteKey = row?.record_key ?? opaqueId()
  const marker = oldBinary?.marker ?? `${BINARY_MARKER_PREFIX}${opaqueId()}`
  const uploaded = await uploadChunks(userId, local.key, local.payload, inspection)
  const ciphertext = await encryptRemoteRow(vaultKey, remoteKey, marker, uploaded.manifest)
  const client = getOnlineDataClient()
  const query = row
    ? client.from('sync_records')
        .update({ ciphertext, version: row.version + 1, deleted: false })
        .eq('user_id', userId).eq('record_key', remoteKey).eq('version', row.version)
        .select('record_key, ciphertext, version, deleted').single()
    : client.from('sync_records')
        .insert({ user_id: userId, record_key: remoteKey, ciphertext, version: 1, deleted: false })
        .select('record_key, ciphertext, version, deleted').single()
  const { data, error } = await query
  if (error || !data) {
    state.cleanupPaths = Array.from(new Set([...state.cleanupPaths, ...uploaded.paths]))
    await writeState(state)
    await flushCleanup(state)
    throw new Error(`Otro dispositivo cambió esta imagen mientras la resolvías. OANIX no sobrescribió nada.${error ? ` ${error.message}` : ''}`)
  }
  const updated = requireRemoteRow(data)
  if (oldBinary) await queueCleanup(state, objectPaths(userId, oldBinary.manifest))
  return { row: updated, marker, manifest: uploaded.manifest } as RemoteBinary
}

async function tombstoneRemote(userId: string, remote: RemoteBinary, state: BinaryState) {
  const { data, error } = await getOnlineDataClient().from('sync_records')
    .update({ ciphertext: null, version: remote.row.version + 1, deleted: true })
    .eq('user_id', userId).eq('record_key', remote.row.record_key).eq('version', remote.row.version)
    .select('record_key, ciphertext, version, deleted').single()
  if (error || !data) throw new Error('Otro dispositivo cambió esta imagen mientras la resolvías. OANIX no sobrescribió nada.')
  const row = requireRemoteRow(data)
  await queueCleanup(state, objectPaths(userId, remote.manifest))
  return row
}

function conflictToken(remoteKey: string, version: number, localFingerprint: string, remoteFingerprint: string) {
  return `${remoteKey}|${version}|${localFingerprint}|${remoteFingerprint}`
}

async function resetPreviewForImage(userId: string, vaultKey: CryptoKey, imageId: string) {
  const previewKey = keyFor(PREVIEW_TYPE, imageId)
  const state = await readState()
  await flushCleanup(state)
  const [locals, rows] = await Promise.all([
    readStoredEncryptedRecordsMatching((key) => key === previewKey),
    fetchRows(userId),
  ])
  if (locals.length > 0) await applyStoredEncryptedRecordChanges([], [previewKey])

  const baseline = state.entries[previewKey]
  const rowByKey = new Map(rows.map((row) => [row.record_key, row]))
  let active: RemoteBinary | null = null
  for (const row of rows) {
    if (row.deleted) continue
    const binary = await decryptRemote(vaultKey, row)
    if (!binary || binary.manifest.localKey !== previewKey) continue
    if (active) throw new Error('La cuenta contiene dos previews activos para la misma imagen. OANIX no los sobrescribirá.')
    active = binary
  }

  if (active) {
    const deleted = await tombstoneRemote(userId, active, state)
    state.entries[previewKey] = {
      remoteKey: deleted.record_key,
      version: deleted.version,
      fingerprint: manifestFingerprint(active.manifest),
      deleted: true,
    }
  } else if (baseline) {
    const row = rowByKey.get(baseline.remoteKey)
    if (row?.deleted) state.entries[previewKey] = { ...baseline, version: row.version, deleted: true }
    else delete state.entries[previewKey]
  }
  await writeState(state)
  await flushCleanup(state)
}

async function buildContext() {
  const session = await getOnlineAccountSession()
  if (!session) return null
  const vaultKey = requireActiveVaultKey()
  const [state, locals, rows] = await Promise.all([
    readState(),
    readStoredEncryptedRecordsMatching((key) => Boolean(parseBinaryKey(key))),
    fetchRows(session.userId),
  ])
  const localByKey = new Map(locals.map((record) => [record.key, record]))
  const remoteByKey = new Map(rows.map((row) => [row.record_key, row]))
  const activeByLocal = new Map<string, RemoteBinary>()
  for (const row of rows) {
    if (row.deleted || row.record_key === BOOTSTRAP_KEY) continue
    const binary = await decryptRemote(vaultKey, row)
    if (!binary) continue
    const localKey = binary.manifest.localKey
    if (activeByLocal.has(localKey)) throw new Error('La cuenta contiene dos manifiestos activos para la misma imagen cifrada.')
    activeByLocal.set(localKey, binary)
  }
  return { session, vaultKey, state, localByKey, remoteByKey, activeByLocal }
}

async function makeConflict(
  localKey: string,
  remoteKey: string,
  remoteVersion: number,
  local: StoredEncryptedSnapshotRecord | null,
  remote: RemoteBinary | null,
  remoteDeleted: boolean,
  resolvable = true,
  reason = '',
): Promise<InternalConflict> {
  const parsed = parseBinaryKey(localKey)
  if (!parsed) throw new Error('La clave binaria del conflicto es inválida.')
  const localInspection = local ? await inspectPayload(local.payload) : null
  const localFingerprint = localInspection?.fingerprint ?? 'deleted'
  const remoteFingerprint = remote ? manifestFingerprint(remote.manifest) : remoteDeleted ? 'deleted' : 'missing'
  return {
    localKey,
    recordId: parsed.recordId,
    remoteKey,
    remoteVersion,
    localDeleted: !local,
    remoteDeleted,
    localPayload: local?.payload ?? null,
    remote,
    localFingerprint,
    remoteFingerprint,
    token: conflictToken(remoteKey, remoteVersion, localFingerprint, remoteFingerprint),
    resolvable,
    reason,
  }
}

async function scanInternal(healPreviews: boolean): Promise<InternalConflict[]> {
  const context = await buildContext()
  if (!context) return []
  const { session, vaultKey, state, localByKey, remoteByKey, activeByLocal } = context
  const keys = new Set([...localByKey.keys(), ...activeByLocal.keys(), ...Object.keys(state.entries).filter((key) => Boolean(parseBinaryKey(key)))])
  const conflicts: InternalConflict[] = []
  const previewsToReset = new Set<string>()

  for (const localKey of keys) {
    const parsed = parseBinaryKey(localKey)
    if (!parsed) continue
    const local = localByKey.get(localKey) ?? null
    const baseline = state.entries[localKey]
    const active = activeByLocal.get(localKey) ?? null
    let conflict: InternalConflict | null = null

    if (!baseline) {
      if (local && active) {
        const localFp = (await inspectPayload(local.payload)).fingerprint
        const remoteFp = manifestFingerprint(active.manifest)
        if (localFp !== remoteFp) conflict = await makeConflict(localKey, active.row.record_key, active.row.version, local, active, false)
      }
    } else {
      const remoteRow = remoteByKey.get(baseline.remoteKey)
      if (!remoteRow) {
        conflict = await makeConflict(localKey, baseline.remoteKey, baseline.version, local, null, false, false, 'La fila remota asociada ya no existe. OANIX no adivinará qué ocurrió.')
      } else if (remoteRow.deleted) {
        if (local && !baseline.deleted) {
          const localFp = (await inspectPayload(local.payload)).fingerprint
          if (localFp !== baseline.fingerprint) conflict = await makeConflict(localKey, remoteRow.record_key, remoteRow.version, local, null, true)
        }
      } else if (!active || active.row.record_key !== baseline.remoteKey) {
        conflict = await makeConflict(localKey, remoteRow.record_key, remoteRow.version, local, active, false, false, 'La identidad remota de esta imagen cambió de forma incompatible.')
      } else {
        const remoteFp = manifestFingerprint(active.manifest)
        if (!local) {
          if (!baseline.deleted && remoteFp !== baseline.fingerprint) conflict = await makeConflict(localKey, active.row.record_key, active.row.version, null, active, false)
        } else {
          const localFp = (await inspectPayload(local.payload)).fingerprint
          if (baseline.deleted) {
            if (localFp !== remoteFp) conflict = await makeConflict(localKey, active.row.record_key, active.row.version, local, active, false)
          } else {
            const localChanged = localFp !== baseline.fingerprint
            const remoteChanged = remoteFp !== baseline.fingerprint
            if (localChanged && remoteChanged && localFp !== remoteFp) {
              conflict = await makeConflict(localKey, active.row.record_key, active.row.version, local, active, false)
            }
          }
        }
      }
    }

    if (!conflict) continue
    if (parsed.recordType === PREVIEW_TYPE && healPreviews) previewsToReset.add(parsed.recordId)
    else conflicts.push(conflict)
  }

  for (const imageId of previewsToReset) await resetPreviewForImage(session.userId, vaultKey, imageId)
  return conflicts
}

export function isBinaryImageConflictSide(value: unknown): value is BinaryImageConflictSide {
  return Boolean(value && typeof value === 'object' && (value as Partial<BinaryImageConflictSide>).kind === 'binary-image')
}

function sideValue(conflict: InternalConflict, side: 'local' | 'remote'): BinaryImageConflictSide | null {
  if (side === 'local') {
    if (conflict.localDeleted || !conflict.localPayload) return null
    return { kind: 'binary-image', encryptedByteLength: base64DecodedLength(conflict.localPayload.ciphertext) }
  }
  if (conflict.remoteDeleted || !conflict.remote) return null
  return { kind: 'binary-image', encryptedByteLength: conflict.remote.manifest.ciphertextByteLength }
}

export async function scanBinarySyncConflicts(): Promise<SyncConflictView[]> {
  const conflicts = (await scanInternal(true)).filter((conflict) => parseBinaryKey(conflict.localKey)?.recordType === IMAGE_TYPE)
  return conflicts.map((conflict) => ({
    localKey: conflict.localKey,
    token: conflict.token,
    label: `Imagen · ${conflict.recordId.slice(0, 8)}`,
    recordType: IMAGE_TYPE,
    recordId: conflict.recordId,
    resolvable: conflict.resolvable,
    reason: conflict.reason,
    remoteAcceptedFirst: true,
    local: { deleted: conflict.localDeleted, value: sideValue(conflict, 'local') },
    remote: { deleted: conflict.remoteDeleted, value: sideValue(conflict, 'remote') },
    canCombine: false,
    combineReason: 'Dos imágenes originales no se fusionan automáticamente. Elige cuál conservar.',
  }))
}

async function findCurrentConflict(localKey: string, token: string) {
  const conflict = (await scanInternal(true)).find((item) => item.localKey === localKey)
  if (!conflict || conflict.token !== token) throw new Error('El conflicto de imagen cambió desde que lo abriste. Vuelve a revisarlo.')
  if (!conflict.resolvable) throw new Error(conflict.reason)
  return conflict
}

async function currentRemote(userId: string, remoteKey: string) {
  const { data, error } = await getOnlineDataClient().from('sync_records')
    .select('record_key, ciphertext, version, deleted')
    .eq('user_id', userId).eq('record_key', remoteKey).single()
  if (error || !data) throw new Error('La versión sincronizada de la imagen cambió. Vuelve a revisar el conflicto.')
  return requireRemoteRow(data)
}

async function currentRemoteBinary(vaultKey: CryptoKey, row: RemoteRow, localKey: string) {
  if (row.deleted) return null
  const binary = await decryptRemote(vaultKey, row)
  if (!binary || binary.manifest.localKey !== localKey) {
    throw new Error('La versión sincronizada de la imagen ya no coincide con el conflicto abierto.')
  }
  return binary
}

function detectMime(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 6) {
    const head = String.fromCharCode(...bytes.subarray(0, 6))
    if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif'
  }
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(...bytes.subarray(0, 4))
    const webp = String.fromCharCode(...bytes.subarray(8, 12))
    if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp'
  }
  return 'application/octet-stream'
}

async function payloadToBlob(vaultKey: CryptoKey, payload: EncryptedVaultPayload, recordId: string) {
  const bytes = await decryptVaultBytes(vaultKey, payload, { recordType: IMAGE_TYPE, recordId })
  const mime = detectMime(bytes)
  if (!mime.startsWith('image/')) throw new Error('La imagen descifrada no tiene un formato visual reconocido.')
  return new Blob([Uint8Array.from(bytes)], { type: mime })
}

export async function loadBinaryImageConflictVisuals(localKey: string, token: string): Promise<BinaryImageConflictVisuals> {
  const session = await getOnlineAccountSession()
  if (!session) throw new Error('Conecta tu cuenta antes de comparar imágenes.')
  const vaultKey = requireActiveVaultKey()
  const conflict = await findCurrentConflict(localKey, token)
  const localBlob = conflict.localPayload ? await payloadToBlob(vaultKey, conflict.localPayload, conflict.recordId) : null
  let remoteBlob: Blob | null = null
  if (conflict.remote) {
    const payload = await downloadPayload(session.userId, conflict.remote.manifest)
    remoteBlob = await payloadToBlob(vaultKey, payload, conflict.recordId)
  }
  return { local: localBlob, remote: remoteBlob }
}

function notify(recordId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: IMAGE_TYPE, recordId } }))
  window.dispatchEvent(new CustomEvent('oanix:conflict-resolved', { detail: { recordType: IMAGE_TYPE, recordId } }))
}

export async function resolveBinarySyncConflict(localKey: string, token: string, choice: SyncConflictResolutionChoice) {
  if (choice === 'combine') throw new Error('Las imágenes originales no se combinan automáticamente.')
  const session = await getOnlineAccountSession()
  if (!session) throw new Error('Conecta tu cuenta antes de resolver conflictos de imágenes.')
  const vaultKey = requireActiveVaultKey()
  const conflict = await findCurrentConflict(localKey, token)
  const state = await readState()
  await flushCleanup(state)
  const locals = await readStoredEncryptedRecordsMatching((key) => key === localKey)
  const local = locals[0] ?? null
  const localInspection = local ? await inspectPayload(local.payload) : null
  const currentLocalFp = localInspection?.fingerprint ?? 'deleted'
  if (currentLocalFp !== conflict.localFingerprint) throw new Error('La imagen de este dispositivo cambió. Vuelve a revisar el conflicto.')

  let row = await currentRemote(session.userId, conflict.remoteKey)
  if (row.version !== conflict.remoteVersion || row.deleted !== conflict.remoteDeleted) {
    throw new Error('La versión sincronizada de la imagen cambió. Vuelve a revisar el conflicto.')
  }
  let remote = await currentRemoteBinary(vaultKey, row, localKey)
  const remoteFp = remote ? manifestFingerprint(remote.manifest) : row.deleted ? 'deleted' : 'missing'
  if (remoteFp !== conflict.remoteFingerprint) throw new Error('La versión sincronizada de la imagen cambió. Vuelve a revisar el conflicto.')

  let finalEntry: StateEntry
  if (choice === 'remote') {
    if (row.deleted || !remote) {
      await applyStoredEncryptedRecordChanges([], [localKey])
      finalEntry = { remoteKey: row.record_key, version: row.version, fingerprint: '', deleted: true }
    } else {
      const payload = await downloadPayload(session.userId, remote.manifest)
      const afterDownload = await currentRemote(session.userId, row.record_key)
      if (afterDownload.version !== row.version || afterDownload.deleted !== row.deleted) {
        throw new Error('La imagen remota cambió mientras se descargaba. OANIX no reemplazó la copia local.')
      }
      await applyStoredEncryptedRecordChanges([{ key: localKey, payload }], [])
      finalEntry = {
        remoteKey: row.record_key,
        version: row.version,
        fingerprint: manifestFingerprint(remote.manifest),
        deleted: false,
      }
    }
  } else {
    if (!local || !localInspection) {
      if (remote) row = await tombstoneRemote(session.userId, remote, state)
      else if (!row.deleted) throw new Error('La versión remota ya no puede eliminarse de forma segura.')
      finalEntry = { remoteKey: row.record_key, version: row.version, fingerprint: '', deleted: true }
    } else {
      const published = await publishLocal(session.userId, vaultKey, local, localInspection, remote ?? row, state)
      row = published.row
      remote = published
      finalEntry = {
        remoteKey: row.record_key,
        version: row.version,
        fingerprint: localInspection.fingerprint,
        deleted: false,
      }
    }
  }

  state.entries[localKey] = finalEntry
  await writeState(state)
  await resetPreviewForImage(session.userId, vaultKey, conflict.recordId)
  notify(conflict.recordId)
}
