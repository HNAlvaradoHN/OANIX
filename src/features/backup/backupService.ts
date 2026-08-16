import {
  readLocalVaultSnapshot,
  replaceLocalVaultSnapshot,
} from '../../storage/repositories/vaultSnapshotRepository'
import {
  encryptedBackupFileName,
  parseEncryptedBackup,
  serializeEncryptedBackup,
} from './backupFormat'

const BACKUP_MIME_TYPE = 'application/vnd.oanix.encrypted-backup+json'

export interface BackupExportResult {
  fileName: string
  recordCount: number
}

export interface BackupRestoreResult {
  exportedAt: string
  recordCount: number
}

export async function downloadEncryptedBackup(): Promise<BackupExportResult> {
  const snapshot = await readLocalVaultSnapshot()
  const now = new Date()
  const fileName = encryptedBackupFileName(now)
  const serialized = serializeEncryptedBackup(snapshot, now)
  const blob = new Blob([serialized], { type: BACKUP_MIME_TYPE })
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

export async function restoreEncryptedBackupFromFile(file: File): Promise<BackupRestoreResult> {
  const serialized = await file.text()
  const backup = parseEncryptedBackup(serialized)
  await replaceLocalVaultSnapshot(backup.vault)

  return {
    exportedAt: backup.exportedAt,
    recordCount: backup.vault.records.length,
  }
}
