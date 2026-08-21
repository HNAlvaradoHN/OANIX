import {
  createLargeObjectTransferProgress,
  DEFAULT_LARGE_OBJECT_CHUNK_BYTES,
} from './largeObjectProtocol.ts'
import {
  ensureProviderCapacityForBytes,
  planLargeObjectCiphertextRanges,
  totalCiphertextBytesForRanges,
  type LargeObjectStorageCapacity,
} from './largeObjectTransferContract.ts'
import {
  uploadLargeObjectResumable,
  type UploadLargeObjectOptions,
  type UploadLargeObjectResult,
} from './largeObjectUploadOrchestrator.ts'
import {
  createLargeObjectTransferUiReporter,
  markLargeObjectTransferFailed,
  type LargeObjectTransferUiMeta,
} from './largeObjectTransferUiStore.ts'

export interface TransferLargeObjectOptions extends UploadLargeObjectOptions {
  ui?: Omit<LargeObjectTransferUiMeta, 'objectId'>
}

export interface TransferLargeObjectResult extends UploadLargeObjectResult {
  capacityBeforeUpload: LargeObjectStorageCapacity | null
  requiredCiphertextBytesBeforeUpload: number
}

export async function transferLargeObject(
  options: TransferLargeObjectOptions,
): Promise<TransferLargeObjectResult> {
  const chunkBytes = options.chunkBytes ?? DEFAULT_LARGE_OBJECT_CHUNK_BYTES
  const ranges = planLargeObjectCiphertextRanges(options.blob.size, chunkBytes)
  const expectedCiphertextBytes = totalCiphertextBytesForRanges(ranges)
  const uiReporter = options.ui
    ? createLargeObjectTransferUiReporter({
        objectId: options.objectId,
        fileName: options.ui.fileName,
        mimeType: options.ui.mimeType,
      })
    : null

  if (uiReporter) {
    uiReporter(createLargeObjectTransferProgress('preparing', 0, options.blob.size))
  }

  const onProgress = uiReporter
    ? (progress: Parameters<NonNullable<UploadLargeObjectOptions['onProgress']>>[0]) => {
        uiReporter(progress)
        options.onProgress?.(progress)
      }
    : options.onProgress

  try {
    const existing = await options.stateStore.load(options.objectId)
    let requiredCiphertextBytes = expectedCiphertextBytes

    if (existing) {
      if (
        existing.checkpoint.objectId !== options.objectId ||
        existing.checkpoint.providerId !== options.provider.providerId ||
        existing.checkpoint.expectedCiphertextBytes !== expectedCiphertextBytes
      ) {
        throw new Error('La transferencia pendiente no coincide con el archivo o proveedor seleccionado.')
      }
      const remoteStatus = await options.provider.inspectResumableUpload({
        providerId: existing.checkpoint.providerId,
        sessionRef: existing.checkpoint.sessionRef,
        objectId: existing.checkpoint.objectId,
        expectedCiphertextBytes,
      })
      if (
        !Number.isSafeInteger(remoteStatus.confirmedCiphertextBytes) ||
        remoteStatus.confirmedCiphertextBytes < 0 ||
        remoteStatus.confirmedCiphertextBytes > expectedCiphertextBytes
      ) {
        throw new Error('El proveedor devolvió un progreso remoto no válido antes de reanudar.')
      }
      requiredCiphertextBytes = expectedCiphertextBytes - remoteStatus.confirmedCiphertextBytes
    }

    const capacityBeforeUpload = await ensureProviderCapacityForBytes(
      options.provider,
      requiredCiphertextBytes,
    )
    const uploaded = await uploadLargeObjectResumable({ ...options, onProgress })
    return {
      ...uploaded,
      capacityBeforeUpload,
      requiredCiphertextBytesBeforeUpload: requiredCiphertextBytes,
    }
  } catch (error) {
    if (uiReporter) markLargeObjectTransferFailed(error)
    throw error
  }
}
