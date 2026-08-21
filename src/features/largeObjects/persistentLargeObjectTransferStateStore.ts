import {
  clearLargeObjectTransferCache,
  loadLargeObjectTransferCache,
  saveLargeObjectTransferCache,
} from '../../storage/local/largeObjectTransferCache.ts'
import type {
  LargeObjectTransferSnapshot,
  LargeObjectTransferStateStore,
} from './largeObjectUploadOrchestrator.ts'

export class PersistentLargeObjectTransferStateStore implements LargeObjectTransferStateStore {
  async load(objectId: string): Promise<LargeObjectTransferSnapshot | null> {
    const loaded = await loadLargeObjectTransferCache()
    if (!loaded) return null
    if (loaded.checkpoint.objectId !== objectId) {
      throw new Error('Ya existe otra transferencia grande pendiente; debe finalizarse o descartarse primero.')
    }
    return {
      checkpoint: loaded.checkpoint,
      retainedChunk: loaded.retainedChunk,
      manifests: loaded.manifests,
    }
  }

  async save(snapshot: LargeObjectTransferSnapshot): Promise<void> {
    await saveLargeObjectTransferCache(
      snapshot.checkpoint,
      snapshot.retainedChunk,
      snapshot.manifests,
    )
  }

  async clear(objectId: string): Promise<void> {
    const loaded = await loadLargeObjectTransferCache()
    if (!loaded) return
    if (loaded.checkpoint.objectId !== objectId) {
      throw new Error('OANIX no borrará la caché temporal de otra transferencia grande.')
    }
    await clearLargeObjectTransferCache()
  }
}
