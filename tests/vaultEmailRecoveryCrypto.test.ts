import assert from 'node:assert/strict'
import test from 'node:test'
import { decryptVaultJson, encryptVaultJson } from '../src/security/crypto/contentCrypto.ts'
import {
  createVaultProtection,
  createVaultProtectionFromRecoveryKey,
  exportVaultKeyForRecovery,
  openVaultProtection,
} from '../src/security/crypto/vaultCrypto.ts'

const ORIGINAL_PASSWORD = 'OANIX original password 2026'
const NEW_PASSWORD = 'OANIX recovered password 2026'

test('email recovery rewraps the same vault key under a new master password', async () => {
  const original = await createVaultProtection(ORIGINAL_PASSWORD)
  const recoveryMaterial = await exportVaultKeyForRecovery(ORIGINAL_PASSWORD, original.protection)
  const nextProtection = await createVaultProtectionFromRecoveryKey(NEW_PASSWORD, recoveryMaterial)
  const recoveredVaultKey = await openVaultProtection(NEW_PASSWORD, nextProtection)

  const payload = await encryptVaultJson(original.vaultKey, { value: 'same-vault' }, {
    recordType: 'test.recovery',
    recordId: 'same-key',
  })

  const restored = await decryptVaultJson<{ value: string }>(recoveredVaultKey, payload, {
    recordType: 'test.recovery',
    recordId: 'same-key',
  })

  assert.equal(restored.value, 'same-vault')
  await assert.rejects(() => openVaultProtection(ORIGINAL_PASSWORD, nextProtection))
})
