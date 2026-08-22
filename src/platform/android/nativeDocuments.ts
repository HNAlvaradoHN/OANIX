import { Capacitor, registerPlugin } from '@capacitor/core'
import { withAndroidSystemInteraction } from './systemInteractionGuard'

export const OANIX_BACKUP_MIME_TYPE = 'application/vnd.oanix.encrypted-backup+json'
const STRING_CHUNK_CHARACTERS = 128 * 1024
const BINARY_BRIDGE_CHUNK_BYTES = 384 * 1024

interface NativeDocumentSelection {
  cancelled: boolean
  uri?: string
  name?: string
  mimeType?: string | null
  byteLength?: number
}

interface NativeSaveSession {
  cancelled: boolean
  sessionId?: string
}

interface NativeSaveResult {
  saved: boolean
  byteLength: number
  uri?: string
}

interface OanixDocumentsPlugin {
  openBackup(): Promise<NativeDocumentSelection>
  beginSaveBackup(options: { fileName: string }): Promise<NativeSaveSession>
  writeBackupChunk(options: { sessionId: string; chunk: string }): Promise<{ bytesWritten: number }>
  finishSaveBackup(options: { sessionId: string }): Promise<NativeSaveResult>
  abortSaveBackup(options: { sessionId: string }): Promise<{ aborted: boolean }>
  beginSaveFile(options: { fileName: string; mimeType: string }): Promise<NativeSaveSession>
  writeFileChunk(options: { sessionId: string; chunkBase64: string }): Promise<{ bytesWritten: number }>
  finishSaveFile(options: { sessionId: string }): Promise<NativeSaveResult>
  abortSaveFile(options: { sessionId: string }): Promise<{ aborted: boolean }>
  openSavedFile(options: { uri: string; mimeType: string }): Promise<{ opened: boolean }>
}

const nativeDocuments = registerPlugin<OanixDocumentsPlugin>('OanixDocuments')

export function isAndroidNativeDocumentsRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

function requireAndroidRuntime(): void {
  if (!isAndroidNativeDocumentsRuntime()) {
    throw new Error('Los archivos nativos solo están disponibles dentro de la aplicación Android de OANIX.')
  }
}

function safeChunkEnd(value: string, start: number): number {
  let end = Math.min(value.length, start + STRING_CHUNK_CHARACTERS)
  if (end < value.length) {
    const previous = value.charCodeAt(end - 1)
    if (previous >= 0xd800 && previous <= 0xdbff) end -= 1
  }
  return end
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let offset = 0; offset < bytes.byteLength; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step))
  }
  return btoa(binary)
}

export async function saveEncryptedBackupWithAndroidDocuments(
  serialized: string,
  fileName: string,
): Promise<boolean> {
  requireAndroidRuntime()
  const session = await withAndroidSystemInteraction(() => nativeDocuments.beginSaveBackup({ fileName }))
  if (session.cancelled) return false
  if (!session.sessionId) throw new Error('Android no pudo crear una sesión de guardado para OANIX.')

  const sessionId = session.sessionId
  let completed = false
  try {
    let offset = 0
    while (offset < serialized.length) {
      const end = safeChunkEnd(serialized, offset)
      if (end <= offset) throw new Error('No se pudo fragmentar el backup de OANIX.')
      await nativeDocuments.writeBackupChunk({
        sessionId,
        chunk: serialized.slice(offset, end),
      })
      offset = end
    }

    const result = await nativeDocuments.finishSaveBackup({ sessionId })
    if (!result.saved || result.byteLength <= 0) {
      throw new Error('Android no confirmó el guardado del backup de OANIX.')
    }
    completed = true
    return true
  } finally {
    if (!completed) {
      try {
        await nativeDocuments.abortSaveBackup({ sessionId })
      } catch {
        // The native side also closes/deletes an unfinished session during teardown.
      }
    }
  }
}

export interface AndroidBinarySaveSession {
  sessionId: string
}

export async function beginAndroidBinaryFileSave(
  fileName: string,
  mimeType: string,
): Promise<AndroidBinarySaveSession | null> {
  requireAndroidRuntime()
  const result = await withAndroidSystemInteraction(() => nativeDocuments.beginSaveFile({ fileName, mimeType }))
  if (result.cancelled) return null
  if (!result.sessionId) throw new Error('Android no pudo crear una sesión para guardar el archivo.')
  return { sessionId: result.sessionId }
}

export async function writeAndroidBinaryFileChunk(
  session: AndroidBinarySaveSession,
  bytes: Uint8Array,
): Promise<void> {
  requireAndroidRuntime()
  if (bytes.byteLength <= 0) return
  for (let offset = 0; offset < bytes.byteLength; offset += BINARY_BRIDGE_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, Math.min(bytes.byteLength, offset + BINARY_BRIDGE_CHUNK_BYTES))
    await nativeDocuments.writeFileChunk({
      sessionId: session.sessionId,
      chunkBase64: bytesToBase64(chunk),
    })
  }
}

export async function finishAndroidBinaryFileSave(
  session: AndroidBinarySaveSession,
  expectedByteLength: number,
): Promise<string> {
  requireAndroidRuntime()
  const result = await nativeDocuments.finishSaveFile({ sessionId: session.sessionId })
  if (!result.saved || result.byteLength !== expectedByteLength || !result.uri?.startsWith('content://')) {
    throw new Error('Android no confirmó un archivo recuperado completo.')
  }
  return result.uri
}

export async function abortAndroidBinaryFileSave(session: AndroidBinarySaveSession): Promise<void> {
  requireAndroidRuntime()
  await nativeDocuments.abortSaveFile({ sessionId: session.sessionId })
}

export async function openAndroidSavedFile(uri: string, mimeType: string): Promise<void> {
  requireAndroidRuntime()
  await withAndroidSystemInteraction(async () => {
    const result = await nativeDocuments.openSavedFile({ uri, mimeType })
    if (!result.opened) throw new Error('Android no pudo abrir el archivo recuperado.')
  })
}

export async function openEncryptedBackupWithAndroidDocuments(): Promise<File | null> {
  requireAndroidRuntime()
  const selection = await withAndroidSystemInteraction(() => nativeDocuments.openBackup())
  if (selection.cancelled) return null

  if (
    typeof selection.uri !== 'string'
    || !selection.uri.startsWith('content://')
    || typeof selection.name !== 'string'
    || !selection.name.trim()
    || (
      selection.byteLength !== undefined
      && (!Number.isSafeInteger(selection.byteLength) || selection.byteLength < 0)
    )
  ) {
    throw new Error('Android devolvió una referencia de archivo no válida.')
  }

  const response = await fetch(Capacitor.convertFileSrc(selection.uri), { cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudo leer el backup seleccionado en Android.')

  const blob = await response.blob()
  if (selection.byteLength !== undefined && blob.size !== selection.byteLength) {
    throw new Error('El backup seleccionado quedó incompleto durante la lectura.')
  }

  return new File([blob], selection.name, {
    type: selection.mimeType || OANIX_BACKUP_MIME_TYPE,
    lastModified: Date.now(),
  })
}
