import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

interface OanixBackPlugin {
  setEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>
  exitApp(): Promise<void>
  addListener(
    eventName: 'backPressed',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>
}

const nativeBack = registerPlugin<OanixBackPlugin>('OanixBack')

export function isAndroidBackRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function setAndroidBackHandlingEnabled(enabled: boolean): Promise<void> {
  if (!isAndroidBackRuntime()) return
  await nativeBack.setEnabled({ enabled })
}

export async function addAndroidBackPressedListener(
  listener: () => void,
): Promise<PluginListenerHandle> {
  return nativeBack.addListener('backPressed', listener)
}

export async function exitAndroidApp(): Promise<void> {
  if (!isAndroidBackRuntime()) return
  await nativeBack.exitApp()
}
