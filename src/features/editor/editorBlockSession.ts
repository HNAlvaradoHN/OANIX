import {
  createEditorBlockChangeBuffer,
  type EditorBlockChangeBuffer,
} from './editorBlockChangeBuffer.ts'
import type {
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
} from './editorSurfaceContract.ts'

export interface EditorBlockSession {
  load(): Promise<EditorSurfaceBlock[]>
  upsert(block: EditorSurfaceBlock): Promise<boolean>
  insert(block: EditorSurfaceBlock, index: number): Promise<boolean>
  remove(blockId: string): Promise<boolean>
  reorder(order: readonly string[]): Promise<boolean>
  hasPending(): boolean
  flush(): Promise<boolean>
}

interface EditorBlockSessionOptions {
  loadBlocks: () => Promise<EditorSurfaceBlock[]>
  saveChanges: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
}

/**
 * Owns one rich-block editing session without owning persistence itself.
 *
 * Loading is lazy and deduplicated. Dirty changes stay in the pure block buffer,
 * while flush checkpoints are serialized so edits made during an in-flight save
 * remain dirty for the next checkpoint. Failed saves keep the same checkpoint
 * available for retry.
 */
export function createEditorBlockSession({
  loadBlocks,
  saveChanges,
}: EditorBlockSessionOptions): EditorBlockSession {
  let buffer: EditorBlockChangeBuffer | null = null
  let loadPromise: Promise<EditorBlockChangeBuffer> | null = null
  let flushPromise: Promise<boolean> | null = null

  async function ensureBuffer(): Promise<EditorBlockChangeBuffer> {
    if (buffer) return buffer
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      const initialBlocks = await loadBlocks()
      const created = createEditorBlockChangeBuffer(initialBlocks)
      buffer = created
      return created
    })()

    try {
      return await loadPromise
    } finally {
      loadPromise = null
    }
  }

  async function flushLoadedBuffer(activeBuffer: EditorBlockChangeBuffer): Promise<boolean> {
    while (activeBuffer.hasPending()) {
      const prepared = activeBuffer.prepare()
      if (!prepared) continue

      const saved = await saveChanges(prepared.changes)
      if (!saved) return false
      activeBuffer.commit(prepared)
    }
    return true
  }

  async function flush(): Promise<boolean> {
    if (!buffer && !loadPromise) return true
    if (flushPromise) return flushPromise

    const operation = (async () => {
      const activeBuffer = await ensureBuffer()
      return flushLoadedBuffer(activeBuffer)
    })()
    flushPromise = operation

    try {
      return await operation
    } finally {
      if (flushPromise === operation) flushPromise = null
    }
  }

  return {
    async load() {
      const activeBuffer = await ensureBuffer()
      return activeBuffer.current()
    },
    async upsert(block) {
      return (await ensureBuffer()).upsert(block)
    },
    async insert(block, index) {
      return (await ensureBuffer()).insert(block, index)
    },
    async remove(blockId) {
      return (await ensureBuffer()).remove(blockId)
    },
    async reorder(order) {
      return (await ensureBuffer()).reorder(order)
    },
    hasPending() {
      return buffer?.hasPending() ?? false
    },
    flush,
  }
}
