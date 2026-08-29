import { Capacitor, registerPlugin } from '@capacitor/core'

interface OanixOutboundSharePlugin {
  shareText(options: { title: string; text: string }): Promise<{ opened: boolean }>
  shareTextFile(options: { title: string; fileName: string; text: string }): Promise<{ opened: boolean }>
  sharePdfText(options: { title: string; fileName: string; text: string }): Promise<{ opened: boolean }>
}

const nativeOutboundShare = registerPlugin<OanixOutboundSharePlugin>('OanixOutboundShare')

export function isAndroidNativeOutboundShare(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function sharePlainText(title: string, text: string): Promise<void> {
  const normalizedTitle = title.trim() || 'Nota de OANIX'
  const normalizedText = text.trim()
  if (!normalizedText) throw new Error('La nota no tiene contenido legible para compartir.')

  if (isAndroidNativeOutboundShare()) {
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

export async function shareTextFileOnAndroid(title: string, fileName: string, text: string): Promise<void> {
  if (!isAndroidNativeOutboundShare()) throw new Error('Esta exportación nativa solo está disponible en Android.')
  await nativeOutboundShare.shareTextFile({
    title: title.trim() || 'Texto de OANIX',
    fileName,
    text,
  })
}

export async function sharePdfTextOnAndroid(title: string, fileName: string, text: string): Promise<void> {
  if (!isAndroidNativeOutboundShare()) throw new Error('Esta exportación nativa solo está disponible en Android.')
  await nativeOutboundShare.sharePdfText({
    title: title.trim() || 'PDF de OANIX',
    fileName,
    text,
  })
}
