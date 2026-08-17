import { Capacitor, registerPlugin } from '@capacitor/core'
import { importTrustedDeviceVaultKey } from '../../security/crypto/trustedDeviceVaultKey'
import { setActiveVaultKey } from '../../security/vault/vaultSession'
import { readVaultMetadata } from '../../storage/repositories/vaultRepository'
import { withAndroidSystemInteraction } from './systemInteractionGuard'

export interface AndroidDeviceCredentialStatus {
  supported: boolean
  enabled: boolean
  minimumApi: number
  vaultBinding?: string
}

interface AndroidDeviceCredentialUnlockResult {
  unlocked: boolean
  vaultKey?: string
  cancelled?: boolean
  requiresPassword?: boolean
  reason?: string
}

interface OanixDeviceCredentialPlugin {
  status(): Promise<AndroidDeviceCredentialStatus>
  unlock(options: { vaultBinding: string }): Promise<AndroidDeviceCredentialUnlockResult>
}

const nativeDeviceCredential = registerPlugin<OanixDeviceCredentialPlugin>('OanixDeviceCredential')

function isAndroidRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

function vaultBinding(createdAt: string): string {
  return `primary:${createdAt}`
}

export async function canUseAndroidDeviceCredentialUnlock(): Promise<boolean> {
  if (!isAndroidRuntime()) return false

  try {
    const metadata = await readVaultMetadata()
    if (!metadata || metadata.protection === 'pending') return false

    const status = await nativeDeviceCredential.status()
    return status.supported
      && status.enabled
      && status.vaultBinding === vaultBinding(metadata.createdAt)
  } catch {
    return false
  }
}

export async function unlockLocalVaultWithDeviceCredential(): Promise<boolean> {
  if (!isAndroidRuntime()) return false

  const metadata = await readVaultMetadata()
  if (!metadata || metadata.protection === 'pending') return false

  const result = await withAndroidSystemInteraction(() => nativeDeviceCredential.unlock({
    vaultBinding: vaultBinding(metadata.createdAt),
  }))
  if (!result.unlocked || !result.vaultKey) return false

  let encodedVaultKey = result.vaultKey
  try {
    const key = await importTrustedDeviceVaultKey(encodedVaultKey)
    setActiveVaultKey(key)
    return true
  } finally {
    encodedVaultKey = ''
  }
}
