import { Capacitor, registerPlugin } from '@capacitor/core'

export interface AndroidKeystoreEnvelope {
  version: 1
  iv: string
  ciphertext: string
}

export interface AndroidKeystoreStatus {
  available: boolean
  keyExists: boolean
  aliasVersion: number
  securityLevel?: number
  insideSecureHardware?: boolean
  userAuthenticationRequired?: boolean
}

interface OanixKeystorePlugin {
  status(): Promise<AndroidKeystoreStatus>
  ensureKey(): Promise<{ created: boolean; aliasVersion: number }>
  seal(options: { plaintext: string; purpose: string }): Promise<AndroidKeystoreEnvelope>
  open(options: AndroidKeystoreEnvelope & { purpose: string }): Promise<{ plaintext: string }>
  deleteKey(): Promise<void>
}

const nativeKeystore = registerPlugin<OanixKeystorePlugin>('OanixKeystore')

export function isAndroidKeystoreRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

function requireAndroidRuntime(): void {
  if (!isAndroidKeystoreRuntime()) {
    throw new Error('Android Keystore solo está disponible dentro de la aplicación Android de OANIX.')
  }
}

export async function getAndroidKeystoreStatus(): Promise<AndroidKeystoreStatus> {
  requireAndroidRuntime()
  return nativeKeystore.status()
}

export async function ensureAndroidDeviceKey(): Promise<void> {
  requireAndroidRuntime()
  await nativeKeystore.ensureKey()
}

export async function sealWithAndroidKeystore(
  plaintext: string,
  purpose: string,
): Promise<AndroidKeystoreEnvelope> {
  requireAndroidRuntime()
  return nativeKeystore.seal({ plaintext, purpose })
}

export async function openWithAndroidKeystore(
  envelope: AndroidKeystoreEnvelope,
  purpose: string,
): Promise<string> {
  requireAndroidRuntime()
  const result = await nativeKeystore.open({ ...envelope, purpose })
  return result.plaintext
}

export async function deleteAndroidDeviceKey(): Promise<void> {
  requireAndroidRuntime()
  await nativeKeystore.deleteKey()
}
