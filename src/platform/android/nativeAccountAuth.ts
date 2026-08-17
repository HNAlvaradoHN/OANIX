import { Capacitor, registerPlugin } from '@capacitor/core'

export const ANDROID_OAUTH_REDIRECT_URL = 'oanix://auth-callback'

interface PendingAuthCallbackResult {
  available: boolean
  url?: string
}

interface OanixAuthPlugin {
  openExternal(options: { url: string }): Promise<{ opened: boolean }>
  consumePendingAuthCallback(): Promise<PendingAuthCallbackResult>
  addListener(
    eventName: 'authCallback',
    listener: () => void,
  ): Promise<{ remove(): Promise<void> }>
}

const OanixAuth = registerPlugin<OanixAuthPlugin>('OanixAuth')

export function isAndroidNativeAccountAuth(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function openAndroidOAuthUrl(url: string): Promise<void> {
  if (!isAndroidNativeAccountAuth()) {
    throw new Error('El flujo OAuth nativo solo está disponible en Android.')
  }
  const result = await OanixAuth.openExternal({ url })
  if (!result.opened) throw new Error('Android no pudo abrir el acceso de Google.')
}

export async function consumePendingAndroidAuthCallback(): Promise<string | null> {
  if (!isAndroidNativeAccountAuth()) return null
  const result = await OanixAuth.consumePendingAuthCallback()
  return result.available && result.url ? result.url : null
}

export async function addAndroidAuthCallbackListener(
  listener: () => void,
): Promise<{ remove(): Promise<void> }> {
  return await OanixAuth.addListener('authCallback', listener)
}
