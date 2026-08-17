import { decryptVaultBytes } from '../../security/crypto/contentCrypto'
import { openVaultProtection } from '../../security/crypto/vaultCrypto'
import { setActiveVaultKey } from '../../security/vault/vaultSession'
import {
  isAndroidNativeDocumentsRuntime,
  OANIX_BACKUP_MIME_TYPE,
  saveEncryptedBackupWithAndroidDocuments,
} from '../../platform/android/nativeDocuments'
import {
  readLocalVaultSnapshot,
  replaceLocalVaultSnapshot,
  type LocalVaultSnapshot,
} from '../../storage/repositories/vaultSnapshotRepository'
import {
  encryptedBackupFileName,
  parseEncryptedBackup,
  serializeEncryptedBackup,
} from './backupFormat'

export interface BackupExportResult {
  fileName: string
  recordCount: number
}

export interface BackupRestoreResult {
  fileName: string
  exportedAt: string
  recordCount: number
}

function parseRecordContext(key: string): { recordType: string; recordId: string } {
  const parsed = JSON.parse(key) as unknown
  if (
    !Array.isArray(parsed)
    || parsed.length !== 2
    || typeof parsed[0] !== 'string'
    || typeof parsed[1] !== 'string'
    || !parsed[0]
    || !parsed[1]
  ) {
    throw new Error('El backup contiene una clave de registro inválida.')
  }

  return { recordType: parsed[0], recordId: parsed[1] }
}

export async function validateEncryptedBackupRecords(
  snapshot: LocalVaultSnapshot,
  vaultKey: CryptoKey,
): Promise<void> {
  for (const record of snapshot.records) {
    const context = parseRecordContext(record.key)
    let plaintext: Uint8Array | null = null
    try {
      plaintext = await decryptVaultBytes(vaultKey, record.payload, context)
    } catch {
      throw new Error('El backup está dañado: no se pudo verificar uno de sus registros cifrados.')
    } finally {
      plaintext?.fill(0)
    }
  }
}

export async function validateEncryptedBackupSnapshot(
  snapshot: LocalVaultSnapshot,
  password: string,
): Promise<CryptoKey> {
  if (snapshot.metadata.protection === 'pending') {
    throw new Error('El backup no contiene una contraseña maestra válida.')
  }

  let vaultKey: CryptoKey
  try {
    vaultKey = await openVaultProtection(password, snapshot.metadata.protection)
  } catch {
    throw new Error('La contraseña del backup no es correcta o la protección del archivo está dañada.')
  }

  await validateEncryptedBackupRecords(snapshot, vaultKey)
  return vaultKey
}

export async function downloadEncryptedBackup(): Promise<BackupExportResult> {
  const snapshot = await readLocalVaultSnapshot()
  const now = new Date()
  const fileName = encryptedBackupFileName(now)
  const serialized = serializeEncryptedBackup(snapshot, now)

  if (isAndroidNativeDocumentsRuntime()) {
    const saved = await saveEncryptedBackupWithAndroidDocuments(serialized, fileName)
    if (!saved) throw new DOMException('Guardado de backup cancelado.', 'AbortError')
    return { fileName, recordCount: snapshot.records.length }
  }

  const blob = new Blob([serialized], { type: OANIX_BACKUP_MIME_TYPE })
  const url = URL.createObjectURL(blob)

  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return { fileName, recordCount: snapshot.records.length }
}

export async function restoreEncryptedBackupFromFile(
  file: File,
  password: string,
): Promise<BackupRestoreResult> {
  const serialized = await file.text()
  const backup = parseEncryptedBackup(serialized)

  // Validate the password and every AES-GCM record before touching the current vault.
  // Records are checked sequentially so large image backups do not create a second
  // plaintext copy of the full vault in memory.
  const restoredVaultKey = await validateEncryptedBackupSnapshot(backup.vault, password)

  // IndexedDB applies the clear + replacement as one transaction. If it aborts,
  // the previous local vault remains intact.
  await replaceLocalVaultSnapshot(backup.vault)
  setActiveVaultKey(restoredVaultKey)

  return {
    fileName: file.name,
    exportedAt: backup.exportedAt,
    recordCount: backup.vault.records.length,
  }
}
