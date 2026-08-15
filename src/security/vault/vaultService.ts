import {
  createVaultProtection,
  MASTER_PASSWORD_MIN_CHARACTERS,
  openVaultProtection,
  validateMasterPassword,
} from '../crypto/vaultCrypto'
import {
  clearActiveVaultKey,
  isVaultUnlocked,
  setActiveVaultKey,
} from './vaultSession'
import {
  readVaultMetadata,
  writeVaultMetadata,
  type VaultMetadata,
} from '../../storage/repositories/vaultRepository'
import {
  deleteEncryptedRecord,
  readEncryptedRecord,
  writeEncryptedRecord,
} from '../../storage/repositories/encryptedRecordRepository'

export { MASTER_PASSWORD_MIN_CHARACTERS }

export type VaultAccessState = 'setup' | 'locked' | 'unlocked'

export type VaultInitializationResult =
  | { status: 'ready'; access: VaultAccessState; created: boolean }
  | { status: 'error'; message: string }

export type VaultActionResult =
  | { status: 'success' }
  | { status: 'error'; message: string }

interface EncryptionProbe {
  version: 1
  token: string
}

const ENCRYPTION_PROBE_TYPE = 'system.encryption-check'

function randomProbeToken(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function initializeLocalVault(): Promise<VaultInitializationResult> {
  try {
    const existingMetadata = await readVaultMetadata()

    if (existingMetadata) {
      const access: VaultAccessState = isVaultUnlocked()
        ? 'unlocked'
        : existingMetadata.protection === 'pending'
          ? 'setup'
          : 'locked'

      return { status: 'ready', access, created: false }
    }

    const metadata: VaultMetadata = {
      key: 'primary',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      protection: 'pending',
    }

    await writeVaultMetadata(metadata)
    return { status: 'ready', access: 'setup', created: true }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown local vault error.',
    }
  }
}

export async function createMasterPassword(password: string): Promise<VaultActionResult> {
  const validationMessage = validateMasterPassword(password)

  if (validationMessage) {
    return { status: 'error', message: validationMessage }
  }

  try {
    const metadata = await readVaultMetadata()

    if (!metadata) {
      return { status: 'error', message: 'La bóveda local todavía no está inicializada.' }
    }

    if (metadata.protection !== 'pending') {
      return { status: 'error', message: 'La bóveda ya tiene una contraseña maestra.' }
    }

    const { protection, vaultKey } = await createVaultProtection(password)

    await writeVaultMetadata({
      ...metadata,
      protection,
    })

    setActiveVaultKey(vaultKey)
    return { status: 'success' }
  } catch {
    clearActiveVaultKey()
    return {
      status: 'error',
      message: 'No se pudo proteger la bóveda. No se guardó la contraseña maestra.',
    }
  }
}

export async function unlockLocalVault(password: string): Promise<VaultActionResult> {
  try {
    const metadata = await readVaultMetadata()

    if (!metadata) {
      return { status: 'error', message: 'La bóveda local no existe.' }
    }

    if (metadata.protection === 'pending') {
      return { status: 'error', message: 'Primero debes crear una contraseña maestra.' }
    }

    const vaultKey = await openVaultProtection(password, metadata.protection)
    setActiveVaultKey(vaultKey)
    return { status: 'success' }
  } catch {
    clearActiveVaultKey()
    return {
      status: 'error',
      message: 'Contraseña incorrecta o datos de la bóveda dañados.',
    }
  }
}

export async function verifyLocalEncryption(): Promise<VaultActionResult> {
  if (!isVaultUnlocked()) {
    return { status: 'error', message: 'La bóveda debe estar desbloqueada para comprobar el cifrado local.' }
  }

  const recordId = randomProbeToken()
  const probe: EncryptionProbe = {
    version: 1,
    token: randomProbeToken(),
  }

  try {
    await writeEncryptedRecord(ENCRYPTION_PROBE_TYPE, recordId, probe)
    const restored = await readEncryptedRecord<EncryptionProbe>(ENCRYPTION_PROBE_TYPE, recordId)

    if (!restored || restored.version !== probe.version || restored.token !== probe.token) {
      throw new Error('Encrypted storage round-trip failed.')
    }

    return { status: 'success' }
  } catch {
    return {
      status: 'error',
      message: 'No se pudo comprobar el cifrado local de OANIX en este dispositivo.',
    }
  } finally {
    try {
      await deleteEncryptedRecord(ENCRYPTION_PROBE_TYPE, recordId)
    } catch {
      // The probe contains no user content. A failed cleanup can be retried on a later verification.
    }
  }
}

export function lockLocalVault(): void {
  clearActiveVaultKey()
}
