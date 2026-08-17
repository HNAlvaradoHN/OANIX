import { Capacitor, registerPlugin } from '@capacitor/core'
import { withAndroidSystemInteraction } from './systemInteractionGuard'

export const OANIX_BACKUP_MIME_TYPE = 'application/vnd.oanix.encrypted-backup+json'
const STRING_CHUNK_CHARACTERS = 128 * 1024

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

interface OanixDocumentsPlugin {
  openBackup(): Promise<NativeDocumentSelection>
  beginSaveBackup(options: { fileName: string }): Promise<NativeSaveSession>
  writeBackupChunk(options: { sessionId: string; chunk: string }): Promise<{ bytesWritten: number }>
  finishSaveBackup(options: { sessionId: string }): Promise<{ saved: boolean; byteLength: number }>
  abortSaveBackup(options: { sessionId: string }): Promise<{ aborted: boolean }>
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
