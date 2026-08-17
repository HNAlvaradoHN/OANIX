import { Capacitor, registerPlugin } from '@capacitor/core'

interface OanixOutboundSharePlugin {
  shareText(options: { title: string; text: string }): Promise<{ opened: boolean }>
}

const nativeOutboundShare = registerPlugin<OanixOutboundSharePlugin>('OanixOutboundShare')

function isAndroidRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function sharePlainText(title: string, text: string): Promise<void> {
  const normalizedTitle = title.trim() || 'Nota de OANIX'
  const normalizedText = text.trim()
  if (!normalizedText) throw new Error('La nota no tiene contenido legible para compartir.')

  if (isAndroidRuntime()) {
    await nativeOutboundShare.shareText({ title: normalizedTitle, text: normalizedText })
    return
  }

  if (typeof navigator.share === 'function') {
    await navigator.share({ title: normalizedTitle, text: normalizedText })
    return
  }

  await navigator.clipboard.writeText(normalizedText)
  window.alert('La nota se copió al portapapeles porque este navegador no ofrece un menú Compartir.')
}
