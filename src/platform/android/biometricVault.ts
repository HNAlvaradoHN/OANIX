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
const TRANSIENT_COLD_START_RETRY_MS = 180

export function isAndroidBiometricRuntime(): boolean {
  return isAndroidKeystoreRuntime()
}

function requireAndroidRuntime(): void {
  if (!isAndroidBiometricRuntime()) {
    throw new Error('El acceso biométrico solo está disponible dentro de la aplicación Android de OANIX.')
  }
}

function waitForNativeActivity(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
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

  const firstAttempt = await withAndroidSystemInteraction(() => nativeBiometric.unlock({ vaultBinding }))
  if (
    firstAttempt.unlocked
    || firstAttempt.cancelled
    || firstAttempt.reason !== 'unavailable'
  ) {
    return firstAttempt
  }

  // On a true cold start Capacitor can reach the plugin a fraction before the FragmentActivity
  // is ready to host BiometricPrompt. Android reports that as "unavailable" even though the
  // enrolled biometric envelope is valid. Retry exactly once after a short activity-settle
  // window; never retry a user cancellation or an authentication failure.
  await waitForNativeActivity(TRANSIENT_COLD_START_RETRY_MS)
  return withAndroidSystemInteraction(() => nativeBiometric.unlock({ vaultBinding }))
}

export async function disableAndroidBiometricVault(): Promise<void> {
  requireAndroidRuntime()
  await nativeBiometric.disable()
}
