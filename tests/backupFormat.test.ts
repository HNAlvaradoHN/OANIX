import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  encryptedBackupFileName,
  parseEncryptedBackup,
  serializeEncryptedBackup,
} from '../src/features/backup/backupFormat.ts'
import { decryptVaultBytes, encryptVaultBytes } from '../src/security/crypto/contentCrypto.ts'
import { createVaultProtection, openVaultProtection } from '../src/security/crypto/vaultCrypto.ts'

const snapshot = {
  metadata: {
    key: 'primary' as const,
    schemaVersion: 1 as const,
    createdAt: '2026-08-15T12:00:00.000Z',
    protection: {
      scheme: 'argon2id-aes-gcm-v1' as const,
      kdf: {
        algorithm: 'argon2id' as const,
        version: 19 as const,
        memoryKiB: 65536 as const,
        iterations: 3 as const,
        parallelism: 1 as const,
        hashLength: 32 as const,
        salt: 'QUJDREVGR0hJSktMTU5PUA==',
      },
      keyWrap: {
        algorithm: 'AES-GCM' as const,
        iv: 'QUJDREVGR0hJSktM',
        wrappedKey: 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=',
      },
    },
  },
  records: [
    {
      key: JSON.stringify(['note', 'note-1']),
      payload: {
        scheme: 'aes-gcm-v1' as const,
        iv: 'QUJDREVGR0hJSktM',
        ciphertext: 'QUJDREVGR0hJSktMTU5PUA==',
      },
    },
  ],
}

test('round-trips an encrypted vault snapshot without plaintext transformation', () => {
  const serialized = serializeEncryptedBackup(snapshot, new Date('2026-08-15T21:30:00.000Z'))
  const parsed = parseEncryptedBackup(serialized)

  assert.equal(parsed.format, 'oanix-encrypted-backup')
  assert.equal(parsed.version, 1)
  assert.deepEqual(parsed.vault, snapshot)
})

test('rejects malformed or duplicate encrypted records', () => {
  const serialized = serializeEncryptedBackup(snapshot)
  const parsed = JSON.parse(serialized)
  parsed.vault.records.push(parsed.vault.records[0])

  assert.throws(() => parseEncryptedBackup(JSON.stringify(parsed)), /duplicados/)
  assert.throws(() => parseEncryptedBackup('{broken json'), /backup válido/)
})

test('uses a portable OANIX backup extension', () => {
  assert.equal(
    encryptedBackupFileName(new Date(2026, 7, 15, 21, 7)),
    'OANIX-backup-2026-08-15-2107.oanixbackup',
  )
})

test('backup cryptography rejects a wrong password and altered encrypted records', async () => {
  const password = 'frase maestra segura para backup'
  const { protection, vaultKey } = await createVaultProtection(password)
  const context = { recordType: 'note', recordId: 'note-secure-1' }
  const payload = await encryptVaultBytes(
    vaultKey,
    new TextEncoder().encode('contenido cifrado de prueba'),
    context,
  )

  const reopenedKey = await openVaultProtection(password, protection)
  const plaintext = await decryptVaultBytes(reopenedKey, payload, context)
  assert.equal(new TextDecoder().decode(plaintext), 'contenido cifrado de prueba')
  plaintext.fill(0)

  await assert.rejects(
    () => openVaultProtection('una contraseña equivocada', protection),
  )

  const corruptedPayload = { ...payload }
  corruptedPayload.ciphertext = `${payload.ciphertext[0] === 'A' ? 'B' : 'A'}${payload.ciphertext.slice(1)}`
  await assert.rejects(
    () => decryptVaultBytes(vaultKey, corruptedPayload, context),
  )
})

test('restore service verifies the complete snapshot before replacing local storage', async () => {
  const source = await readFile(
    new URL('../src/features/backup/backupService.ts', import.meta.url),
    'utf8',
  )
  const restoreStart = source.indexOf('export async function restoreEncryptedBackupFromFile')
  assert.ok(restoreStart >= 0)

  const restoreSource = source.slice(restoreStart)
  const validationPosition = restoreSource.indexOf('validateEncryptedBackupSnapshot(backup.vault, password)')
  const replacementPosition = restoreSource.indexOf('replaceLocalVaultSnapshot(backup.vault)')

  assert.ok(validationPosition >= 0)
  assert.ok(replacementPosition > validationPosition)
  assert.match(source, /for \(const record of snapshot\.records\)/)
  assert.match(source, /plaintext\?\.fill\(0\)/)
})
