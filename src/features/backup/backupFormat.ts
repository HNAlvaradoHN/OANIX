import type { EncryptedVaultPayload } from '../../security/crypto/contentCrypto'
import type { VaultMetadata } from '../../storage/repositories/vaultRepository'
import type {
  LocalVaultSnapshot,
  StoredEncryptedSnapshotRecord,
} from '../../storage/repositories/vaultSnapshotRepository'

const BACKUP_FORMAT = 'oanix-encrypted-backup' as const
const BACKUP_VERSION = 1 as const

export interface OanixEncryptedBackupV1 {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  vault: LocalVaultSnapshot
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isBase64(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}

function isEncryptedPayload(value: unknown): value is EncryptedVaultPayload {
  if (!isObject(value)) return false
  return value.scheme === 'aes-gcm-v1' && isBase64(value.iv) && isBase64(value.ciphertext)
}

function isRecordKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      && parsed.length === 2
      && typeof parsed[0] === 'string'
      && parsed[0].length > 0
      && typeof parsed[1] === 'string'
      && parsed[1].length > 0
  } catch {
    return false
  }
}

function isEncryptedRecord(value: unknown): value is StoredEncryptedSnapshotRecord {
  if (!isObject(value)) return false
  return isRecordKey(value.key) && isEncryptedPayload(value.payload)
}

function isVaultMetadata(value: unknown): value is VaultMetadata {
  if (!isObject(value)) return false
  if (
    value.key !== 'primary'
    || value.schemaVersion !== 1
    || typeof value.createdAt !== 'string'
    || value.protection === 'pending'
    || !isObject(value.protection)
  ) {
    return false
  }

  const protection = value.protection
  if (protection.scheme !== 'argon2id-aes-gcm-v1') return false
  if (!isObject(protection.kdf) || !isObject(protection.keyWrap)) return false

  return protection.kdf.algorithm === 'argon2id'
    && protection.kdf.version === 19
    && protection.kdf.memoryKiB === 65536
    && protection.kdf.iterations === 3
    && protection.kdf.parallelism === 1
    && protection.kdf.hashLength === 32
    && isBase64(protection.kdf.salt)
    && protection.keyWrap.algorithm === 'AES-GCM'
    && isBase64(protection.keyWrap.iv)
    && isBase64(protection.keyWrap.wrappedKey)
}

export function createEncryptedBackup(snapshot: LocalVaultSnapshot, now = new Date()): OanixEncryptedBackupV1 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    vault: snapshot,
  }
}

export function serializeEncryptedBackup(snapshot: LocalVaultSnapshot, now = new Date()): string {
  return JSON.stringify(createEncryptedBackup(snapshot, now))
}

export function parseEncryptedBackup(serialized: string): OanixEncryptedBackupV1 {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    throw new Error('El archivo no contiene un backup válido de OANIX.')
  }

  if (!isObject(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error('Formato o versión de backup no compatible con esta versión de OANIX.')
  }
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error('El backup no contiene una fecha de exportación válida.')
  }
  if (!isObject(value.vault) || !isVaultMetadata(value.vault.metadata) || !Array.isArray(value.vault.records)) {
    throw new Error('La estructura cifrada del backup no es válida.')
  }
  if (!value.vault.records.every(isEncryptedRecord)) {
    throw new Error('El backup contiene registros cifrados inválidos.')
  }

  const keys = value.vault.records.map((record) => record.key)
  if (new Set(keys).size !== keys.length) {
    throw new Error('El backup contiene registros cifrados duplicados.')
  }

  return value as unknown as OanixEncryptedBackupV1
}

export function encryptedBackupFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    'OANIX-backup',
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    `${pad(now.getHours())}${pad(now.getMinutes())}`,
  ].join('-') + '.oanixbackup'
}
