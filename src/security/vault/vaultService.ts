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

export { MASTER_PASSWORD_MIN_CHARACTERS }

export type VaultAccessState = 'setup' | 'locked' | 'unlocked'

export type VaultInitializationResult =
  | { status: 'ready'; access: VaultAccessState; created: boolean }
  | { status: 'error'; message: string }

export type VaultActionResult =
  | { status: 'success' }
  | { status: 'error'; message: string }

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

export function lockLocalVault(): void {
  clearActiveVaultKey()
}
