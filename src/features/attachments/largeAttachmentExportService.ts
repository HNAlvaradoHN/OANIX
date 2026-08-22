import {
  abortAndroidBinaryFileSave,
  beginAndroidBinaryFileSave,
  finishAndroidBinaryFileSave,
  isAndroidNativeDocumentsRuntime,
  openAndroidSavedFile,
  writeAndroidBinaryFileChunk,
} from '../../platform/android/nativeDocuments'
import { recoverLargeAttachmentFromDrive, type RecoverLargeAttachmentProgress } from './largeAttachmentDriveService'
import { isRemoteLargeAttachment, type AttachmentMetadata } from './attachmentTypes'

const FALLBACK_BLOB_LIMIT_BYTES = 256 * 1024 * 1024

interface FileSystemWritableLike {
  write(data: Uint8Array): Promise<void>
  close(): Promise<void>
  abort?(reason?: unknown): Promise<void>
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableLike>
  getFile(): Promise<File>
}

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string
    types?: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandleLike>
}

export interface RemoteAttachmentExportOptions {
  openAfterSave?: boolean
  onProgress?: (progress: RecoverLargeAttachmentProgress) => void
  signal?: AbortSignal
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return ''
  const extension = name.slice(dot).toLowerCase()
  return /^\.[a-z0-9]{1,12}$/u.test(extension) ? extension : ''
}

function openFileInBrowser(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

async function exportOnAndroid(
  item: AttachmentMetadata,
  options: RemoteAttachmentExportOptions,
): Promise<'saved' | 'cancelled'> {
  if (!item.storage) throw new Error('El adjunto remoto no contiene información de almacenamiento.')
  if (options.signal?.aborted) return 'cancelled'
  const session = await beginAndroidBinaryFileSave(item.name, item.mimeType)
  if (!session) return 'cancelled'

  let completed = false
  try {
    await recoverLargeAttachmentFromDrive(
      item.storage,
      item.byteLength,
      async (bytes) => writeAndroidBinaryFileChunk(session, bytes),
      options.onProgress,
      options.signal,
    )
    if (options.signal?.aborted) return 'cancelled'
    const uri = await finishAndroidBinaryFileSave(session, item.byteLength)
    completed = true
    if (options.openAfterSave) await openAndroidSavedFile(uri, item.mimeType)
    return 'saved'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  } finally {
    if (!completed) {
      try {
        await abortAndroidBinaryFileSave(session)
      } catch {
        // Native side also removes unfinished output when the session dies.
      }
    }
  }
}

async function exportWithFileSystemAccess(
  item: AttachmentMetadata,
  options: RemoteAttachmentExportOptions,
  picker: NonNullable<SaveFilePickerWindow['showSaveFilePicker']>,
): Promise<'saved' | 'cancelled'> {
  if (!item.storage) throw new Error('El adjunto remoto no contiene información de almacenamiento.')
  if (options.signal?.aborted) return 'cancelled'

  let handle: FileSystemFileHandleLike
  try {
    const extension = extensionOf(item.name)
    handle = await picker({
      suggestedName: item.name,
      types: [{
        description: 'Archivo recuperado de OANIX',
        accept: { [item.mimeType || 'application/octet-stream']: extension ? [extension] : [] },
      }],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  }

  const writable = await handle.createWritable()
  let completed = false
  try {
    await recoverLargeAttachmentFromDrive(
      item.storage,
      item.byteLength,
      async (bytes) => writable.write(Uint8Array.from(bytes)),
      options.onProgress,
      options.signal,
    )
    if (options.signal?.aborted) return 'cancelled'
    await writable.close()
    completed = true
    if (options.openAfterSave) openFileInBrowser(await handle.getFile())
    return 'saved'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  } finally {
    if (!completed && writable.abort) {
      try {
        await writable.abort('OANIX canceló una recuperación incompleta.')
      } catch {
        // Best effort. Browser controls cleanup for its temporary writable.
      }
    }
  }
}

async function exportWithBlobFallback(
  item: AttachmentMetadata,
  options: RemoteAttachmentExportOptions,
): Promise<'saved' | 'cancelled'> {
  if (!item.storage) throw new Error('El adjunto remoto no contiene información de almacenamiento.')
  if (item.byteLength > FALLBACK_BLOB_LIMIT_BYTES) {
    throw new Error('Este navegador no permite guardar archivos tan grandes de forma progresiva. Usa la app Android de OANIX o un navegador compatible con guardado directo.')
  }
  if (options.signal?.aborted) return 'cancelled'

  const parts: BlobPart[] = []
  try {
    await recoverLargeAttachmentFromDrive(
      item.storage,
      item.byteLength,
      async (bytes) => { parts.push(Uint8Array.from(bytes)) },
      options.onProgress,
      options.signal,
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  }
  if (options.signal?.aborted) return 'cancelled'
  const file = new File(parts, item.name, {
    type: item.mimeType,
    lastModified: Date.parse(item.createdAt) || Date.now(),
  })
  if (file.size !== item.byteLength) throw new Error('El archivo recuperado quedó incompleto.')
  if (options.openAfterSave) openFileInBrowser(file)
  else downloadFile(file)
  return 'saved'
}

export async function exportRemoteLargeAttachment(
  item: AttachmentMetadata,
  options: RemoteAttachmentExportOptions = {},
): Promise<'saved' | 'cancelled'> {
  if (!isRemoteLargeAttachment(item) || !item.storage) {
    throw new Error('El archivo seleccionado no es un adjunto grande remoto.')
  }

  if (isAndroidNativeDocumentsRuntime()) {
    return exportOnAndroid(item, options)
  }

  const picker = (window as SaveFilePickerWindow).showSaveFilePicker
  if (typeof picker === 'function') {
    return exportWithFileSystemAccess(item, options, picker.bind(window))
  }

  return exportWithBlobFallback(item, options)
}
