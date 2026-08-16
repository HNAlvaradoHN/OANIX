import {
  decryptVaultJson,
  encryptVaultJson,
  type EncryptedVaultPayload,
} from '../../security/crypto/contentCrypto'
import { requireActiveVaultKey } from '../../security/vault/vaultSession'
import {
  readStoredEncryptedRecordsMatching,
  type StoredEncryptedSnapshotRecord,
} from '../../storage/repositories/vaultSnapshotRepository'
import { getOnlineAccountSession, getOnlineDataClient } from '../account/accountService'

const SYNC_ENVELOPE_PROTOCOL = 'oanix-sync-envelope-v1' as const
const SYNC_ENVELOPE_RECORD_TYPE = 'sync-envelope'
const BINARY_RECORD_TYPES = new Set(['image', 'image-preview'])

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
  ciphertext: string
  version: number
  deleted: boolean
}

export interface EncryptedSyncResult {
  uploaded: number
  verified: number
  skippedBinary: number
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

function requireRemoteRow(value: unknown): RemoteSyncRow {
  if (!value || typeof value !== 'object') {
    throw new Error('Supabase devolvió un registro de sincronización inválido.')
  }

  const row = value as Partial<RemoteSyncRow>
  if (
    typeof row.record_key !== 'string' ||
    row.record_key.length === 0 ||
    typeof row.ciphertext !== 'string' ||
    row.ciphertext.length === 0 ||
    typeof row.version !== 'number' ||
    !Number.isSafeInteger(row.version) ||
    row.version <= 0 ||
    typeof row.deleted !== 'boolean'
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

async function opaqueRecordKey(userId: string, localKey: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto no está disponible para preparar la sincronización.')
  }

  const input = new TextEncoder().encode(
    JSON.stringify(['OANIX', 'sync-key', 1, userId, localKey]),
  )
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
  return base64Url(new Uint8Array(digest))
}

async function encryptRecordForSync(
  vaultKey: CryptoKey,
  userId: string,
  record: StoredEncryptedSnapshotRecord,
): Promise<{ recordKey: string; ciphertext: string }> {
  const recordKey = await opaqueRecordKey(userId, record.key)
  const envelope: SyncEnvelope = {
    protocol: SYNC_ENVELOPE_PROTOCOL,
    localKey: record.key,
    payload: record.payload,
  }
  const encryptedEnvelope = await encryptVaultJson(vaultKey, envelope, {
    recordType: SYNC_ENVELOPE_RECORD_TYPE,
    recordId: recordKey,
  })

  return {
    recordKey,
    ciphertext: JSON.stringify(encryptedEnvelope),
  }
}

async function verifyRemoteEnvelope(
  vaultKey: CryptoKey,
  expectedRecord: StoredEncryptedSnapshotRecord,
  row: RemoteSyncRow,
): Promise<void> {
  if (row.deleted) {
    throw new Error('El servidor devolvió como eliminado un registro recién enviado.')
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

  if (
    decoded.localKey !== expectedRecord.key ||
    JSON.stringify(decoded.payload) !== JSON.stringify(expectedRecord.payload)
  ) {
    throw new Error('La verificación E2EE no coincide con el registro local.')
  }
}

export async function sendEncryptedVaultRecords(): Promise<EncryptedSyncResult> {
  const session = await getOnlineAccountSession()
  if (!session) {
    throw new Error('Inicia sesión en tu cuenta OANIX antes de enviar registros cifrados.')
  }

  const vaultKey = requireActiveVaultKey()
  let skippedBinary = 0
  const records = await readStoredEncryptedRecordsMatching((key) => {
    const parsed = parseLocalRecordKey(key)
    if (!parsed) return false
    if (BINARY_RECORD_TYPES.has(parsed.recordType)) {
      skippedBinary += 1
      return false
    }
    return true
  })

  if (records.length === 0) {
    return { uploaded: 0, verified: 0, skippedBinary }
  }

  const client = getOnlineDataClient()
  const { data: existingData, error: existingError } = await client
    .from('sync_records')
    .select('record_key, version')
    .eq('user_id', session.userId)

  if (existingError) {
    throw new Error(`No se pudo consultar el estado cifrado remoto: ${existingError.message}`)
  }

  const existingVersions = new Map<string, number>()
  for (const value of existingData ?? []) {
    if (
      value &&
      typeof value.record_key === 'string' &&
      typeof value.version === 'number' &&
      Number.isSafeInteger(value.version) &&
      value.version > 0
    ) {
      existingVersions.set(value.record_key, value.version)
    }
  }

  let uploaded = 0
  let verified = 0

  for (const record of records) {
    const prepared = await encryptRecordForSync(vaultKey, session.userId, record)
    const currentVersion = existingVersions.get(prepared.recordKey)

    const query = currentVersion === undefined
      ? client
          .from('sync_records')
          .insert({
            user_id: session.userId,
            record_key: prepared.recordKey,
            ciphertext: prepared.ciphertext,
            version: 1,
            deleted: false,
          })
          .select('record_key, ciphertext, version, deleted')
          .single()
      : client
          .from('sync_records')
          .update({
            ciphertext: prepared.ciphertext,
            version: currentVersion + 1,
            deleted: false,
          })
          .eq('user_id', session.userId)
          .eq('record_key', prepared.recordKey)
          .select('record_key, ciphertext, version, deleted')
          .single()

    const { data, error } = await query
    if (error) {
      throw new Error(`No se pudo enviar un registro cifrado: ${error.message}`)
    }

    const row = requireRemoteRow(data)
    if (row.record_key !== prepared.recordKey) {
      throw new Error('El servidor devolvió una clave opaca distinta a la enviada.')
    }

    uploaded += 1
    await verifyRemoteEnvelope(vaultKey, record, row)
    verified += 1
  }

  return { uploaded, verified, skippedBinary }
}
