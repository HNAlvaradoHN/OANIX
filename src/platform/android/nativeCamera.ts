import { Capacitor, registerPlugin } from '@capacitor/core'

const MAX_NATIVE_CAMERA_BYTES = 24 * 1024 * 1024

interface NativeCameraResult {
  cancelled: boolean
  mimeType?: string
  byteLength?: number
  base64?: string
}

interface OanixCameraPlugin {
  takePhoto(): Promise<NativeCameraResult>
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

function decodeBase64(value: string): Uint8Array {
  let binary: string
  try {
    binary = atob(value)
  } catch {
    throw new Error('La cámara devolvió una foto ilegible.')
  }

  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function cameraFileName(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return `Foto-OANIX-${stamp}.jpg`
}

export async function captureAndroidCameraPhoto(): Promise<File | null> {
  requireAndroidRuntime()
  const result = await nativeCamera.takePhoto()
  if (result.cancelled) return null

  if (
    result.mimeType !== 'image/jpeg'
    || typeof result.byteLength !== 'number'
    || !Number.isSafeInteger(result.byteLength)
    || result.byteLength <= 0
    || result.byteLength > MAX_NATIVE_CAMERA_BYTES
    || typeof result.base64 !== 'string'
    || result.base64.length === 0
  ) {
    throw new Error('La cámara devolvió una foto con metadatos inválidos.')
  }

  const bytes = decodeBase64(result.base64)
  try {
    if (bytes.byteLength !== result.byteLength) {
      throw new Error('La foto capturada quedó incompleta durante la transferencia.')
    }

    return new File([bytes], cameraFileName(), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bytes.fill(0)
  }
}
