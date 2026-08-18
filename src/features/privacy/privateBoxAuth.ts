import { openVaultProtection } from '../../security/crypto/vaultCrypto'
import { readVaultMetadata } from '../../storage/repositories/vaultRepository'
import {
  getAndroidBiometricVaultStatus,
  isAndroidBiometricRuntime,
  unlockAndroidBiometricVault,
} from '../../platform/android/biometricVault'

export type PrivateBoxAuthResult =
  | { status: 'success' }
  | { status: 'error'; message: string; cancelled?: boolean; unavailable?: boolean }

function biometricVaultBinding(createdAt: string): string {
  return `primary:${createdAt}`
}

export async function canUsePrivateBoxDeviceAuth(): Promise<boolean> {
  if (!isAndroidBiometricRuntime()) return false

  try {
    const metadata = await readVaultMetadata()
    if (!metadata || metadata.protection === 'pending') return false
    const binding = biometricVaultBinding(metadata.createdAt)
    const status = await getAndroidBiometricVaultStatus()
    return status.supported && status.enabled && status.vaultBinding === binding
  } catch {
    return false
  }
}

export async function reauthenticatePrivateBoxWithDevice(): Promise<PrivateBoxAuthResult> {
  if (!isAndroidBiometricRuntime()) {
    return { status: 'error', unavailable: true, message: 'La autenticación del dispositivo no está disponible aquí.' }
  }

  try {
    const metadata = await readVaultMetadata()
    if (!metadata || metadata.protection === 'pending') {
      return { status: 'error', unavailable: true, message: 'La bóveda local todavía no está lista.' }
    }

    const binding = biometricVaultBinding(metadata.createdAt)
    const status = await getAndroidBiometricVaultStatus()
    if (!status.supported || !status.enabled || status.vaultBinding !== binding) {
      return { status: 'error', unavailable: true, message: 'Usa tu contraseña maestra para abrir la Caja privada.' }
    }

    const result = await unlockAndroidBiometricVault(binding)
    let encodedVaultKey = result.vaultKey ?? ''
    try {
      if (result.unlocked) return { status: 'success' }
      return {
        status: 'error',
        cancelled: result.cancelled === true,
        message: result.cancelled
          ? 'Autenticación cancelada.'
          : 'No se pudo confirmar tu identidad con el dispositivo.',
      }
    } finally {
      encodedVaultKey = ''
      void encodedVaultKey
    }
  } catch {
    return { status: 'error', message: 'No se pudo iniciar la autenticación del dispositivo.' }
  }
}

export async function reauthenticatePrivateBoxWithPassword(password: string): Promise<PrivateBoxAuthResult> {
  try {
    const metadata = await readVaultMetadata()
    if (!metadata || metadata.protection === 'pending') {
      return { status: 'error', message: 'La bóveda local todavía no está lista.' }
    }

    // This derives and verifies a vault key but intentionally does not replace,
    // clear or persist the active session key. It is re-authentication only.
    await openVaultProtection(password, metadata.protection)
    return { status: 'success' }
  } catch {
    return { status: 'error', message: 'Contraseña maestra incorrecta.' }
  }
}
