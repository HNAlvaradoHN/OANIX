import { registerPlugin } from '@capacitor/core'
import { isAndroidKeystoreRuntime } from './keystore'
import { withAndroidSystemInteraction } from './systemInteractionGuard'

export interface AndroidBiometricVaultStatus {
  supported: boolean
  enabled: boolean
  minimumApi: number
  availability: number
  vaultBinding?: string
}

export interface AndroidBiometricEnableResult {
  enabled: boolean
  cancelled?: boolean
  unsupported?: boolean
}

export interface AndroidBiometricUnlockResult {
  unlocked: boolean
  vaultKey?: string
  cancelled?: boolean
  requiresPassword?: boolean
  reason?: string
}

interface OanixBiometricPlugin {
  status(): Promise<AndroidBiometricVaultStatus>
  enable(options: { vaultKey: string; vaultBinding: string }): Promise<AndroidBiometricEnableResult>
  unlock(options: { vaultBinding: string }): Promise<AndroidBiometricUnlockResult>
  disable(): Promise<{ disabled: boolean }>
}

const nativeBiometric = registerPlugin<OanixBiometricPlugin>('OanixBiometric')

export function isAndroidBiometricRuntime(): boolean {
  return isAndroidKeystoreRuntime()
}

function requireAndroidRuntime(): void {
  if (!isAndroidBiometricRuntime()) {
    throw new Error('El acceso biométrico solo está disponible dentro de la aplicación Android de OANIX.')
  }
}

export async function getAndroidBiometricVaultStatus(): Promise<AndroidBiometricVaultStatus> {
  requireAndroidRuntime()
  return nativeBiometric.status()
}

export async function enableAndroidBiometricVault(
  vaultKey: string,
  vaultBinding: string,
): Promise<AndroidBiometricEnableResult> {
  requireAndroidRuntime()
  return withAndroidSystemInteraction(() => nativeBiometric.enable({ vaultKey, vaultBinding }))
}

export async function unlockAndroidBiometricVault(
  vaultBinding: string,
): Promise<AndroidBiometricUnlockResult> {
  requireAndroidRuntime()
  return withAndroidSystemInteraction(() => nativeBiometric.unlock({ vaultBinding }))
}

export async function disableAndroidBiometricVault(): Promise<void> {
  requireAndroidRuntime()
  await nativeBiometric.disable()
}
