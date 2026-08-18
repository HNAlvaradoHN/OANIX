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
const TRANSIENT_COLD_START_RETRY_DELAYS_MS = [180, 420, 800] as const

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

function shouldRetryTransientColdStart(result: AndroidBiometricUnlockResult): boolean {
  return !result.unlocked
    && !result.cancelled
    && result.reason === 'unavailable'
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

  let result = await withAndroidSystemInteraction(() => nativeBiometric.unlock({ vaultBinding }))

  // A true Android cold start can reach Capacitor before the FragmentActivity is fully ready to
  // host BiometricPrompt. The native bridge reports that transient state as "unavailable". Keep a
  // short, bounded settle window instead of making the user reopen OANIX. Never retry a prompt
  // that was shown and cancelled, nor any real authentication error/fallback condition.
  for (const delay of TRANSIENT_COLD_START_RETRY_DELAYS_MS) {
    if (!shouldRetryTransientColdStart(result)) return result
    await waitForNativeActivity(delay)
    result = await withAndroidSystemInteraction(() => nativeBiometric.unlock({ vaultBinding }))
  }

  return result
}

export async function disableAndroidBiometricVault(): Promise<void> {
  requireAndroidRuntime()
  await nativeBiometric.disable()
}
