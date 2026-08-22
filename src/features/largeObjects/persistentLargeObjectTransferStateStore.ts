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
      // Only one transfer slot exists. A different newly-selected file cannot safely
      // resume the previous upload because the original File bytes are no longer
      // guaranteed to be available. Discard the obsolete encrypted checkpoint and
      // let the new file start a fresh resumable Drive session automatically.
      await clearLargeObjectTransferCache()
      return null
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
