import { Capacitor, registerPlugin } from '@capacitor/core'
import { withAndroidSystemInteraction } from './systemInteractionGuard'

const MAX_NATIVE_CAMERA_BYTES = 24 * 1024 * 1024

interface NativeCameraResult {
  cancelled: boolean
  mimeType?: string
  byteLength?: number
  uri?: string
}

interface OanixCameraPlugin {
  takePhoto(): Promise<NativeCameraResult>
  finishPhoto(): Promise<{ finished: boolean }>
}

const nativeCamera = registerPlugin<OanixCameraPlugin>('OanixCamera')

export function isAndroidNativeCameraRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

function requireAndroidRuntime(): void {
  if (!isAndroidNativeCameraRuntime()) {
    throw new Error('La cámara nativa solo está disponible dentro de la aplicación Android de OANIX.')
  }
}

function cameraFileName(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return `Foto-OANIX-${stamp}.jpg`
}

export async function captureAndroidCameraPhoto(): Promise<File | null> {
  requireAndroidRuntime()
  const result = await withAndroidSystemInteraction(() => nativeCamera.takePhoto())
  if (result.cancelled) return null

  try {
    if (
      result.mimeType !== 'image/jpeg'
      || typeof result.byteLength !== 'number'
      || !Number.isSafeInteger(result.byteLength)
      || result.byteLength <= 0
      || result.byteLength > MAX_NATIVE_CAMERA_BYTES
      || typeof result.uri !== 'string'
      || !result.uri.startsWith('content://')
    ) {
      throw new Error('La cámara devolvió una foto con metadatos inválidos.')
    }

    const response = await fetch(Capacitor.convertFileSrc(result.uri), { cache: 'no-store' })
    if (!response.ok) throw new Error('No se pudo leer la foto temporal de la cámara.')

    const blob = await response.blob()
    if (blob.size !== result.byteLength) {
      throw new Error('La foto capturada quedó incompleta durante la transferencia.')
    }

    return new File([blob], cameraFileName(), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    try {
      await nativeCamera.finishPhoto()
    } catch {
      // The native plugin also removes abandoned OANIX camera captures on later startup.
    }
  }
}
