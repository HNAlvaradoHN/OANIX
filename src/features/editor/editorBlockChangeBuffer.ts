import type {
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
} from './editorSurfaceContract'

interface PreparedBlockEntry {
  block: EditorSurfaceBlock | null
  generation: number
}

export interface PreparedEditorBlockChanges {
  changes: EditorSurfaceBlockChangeSet
  entries: ReadonlyMap<string, PreparedBlockEntry>
  order: readonly string[] | null
  orderGeneration: number
}

export interface EditorBlockChangeBuffer {
  upsert(block: EditorSurfaceBlock): boolean
  remove(blockId: string): boolean
  reorder(order: readonly string[]): boolean
  hasPending(): boolean
  prepare(): PreparedEditorBlockChanges | null
  commit(prepared: PreparedEditorBlockChanges): void
  current(): EditorSurfaceBlock[]
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null) return false
  if (typeof left !== typeof right) return false

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => valuesEqual(value, right[index]))
  }

  if (typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const leftKeys = Object.keys(leftRecord)
    const rightKeys = Object.keys(rightRecord)
    if (leftKeys.length !== rightKeys.length) return false
    return leftKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(rightRecord, key)
        && valuesEqual(leftRecord[key], rightRecord[key]),
    )
  }

  return false
}

function blocksEqual(left: EditorSurfaceBlock, right: EditorSurfaceBlock): boolean {
  return left.id === right.id
    && left.kind === right.kind
    && valuesEqual(left.data, right.data)
}

function ordersEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function uniqueOrderFor(order: readonly string[], blocks: ReadonlyMap<string, EditorSurfaceBlock>): string[] {
  if (order.length !== blocks.size) {
    throw new Error('Block order must contain every current block exactly once.')
  }

  const seen = new Set<string>()
  for (const id of order) {
    if (!blocks.has(id) || seen.has(id)) {
      throw new Error('Block order must contain every current block exactly once.')
    }
    seen.add(id)
  }
  return [...order]
}

export function createEditorBlockChangeBuffer(
  initialBlocks: readonly EditorSurfaceBlock[] = [],
): EditorBlockChangeBuffer {
  const currentBlocks = new Map(initialBlocks.map((block) => [block.id, block]))
  const committedBlocks = new Map(currentBlocks)
  let currentOrder = initialBlocks.map((block) => block.id)
  let committedOrder = [...currentOrder]
  const dirtyGenerations = new Map<string, number>()
  let generation = 0
  let orderGeneration = 0
  let orderDirty = false

  function markBlockDirty(blockId: string) {
    generation += 1
    dirtyGenerations.set(blockId, generation)
  }

  function markOrderDirty() {
    generation += 1
    orderGeneration = generation
    orderDirty = !ordersEqual(currentOrder, committedOrder)
  }

  function upsert(block: EditorSurfaceBlock): boolean {
    const existing = currentBlocks.get(block.id)
    if (existing && blocksEqual(existing, block)) return false

    const isNew = !existing
    currentBlocks.set(block.id, block)
    markBlockDirty(block.id)

    if (isNew) {
      currentOrder = [...currentOrder, block.id]
      markOrderDirty()
    }
    return true
  }

  function remove(blockId: string): boolean {
    if (!currentBlocks.has(blockId)) return false

    currentBlocks.delete(blockId)
    markBlockDirty(blockId)
    currentOrder = currentOrder.filter((id) => id !== blockId)
    markOrderDirty()
    return true
  }

  function reorder(order: readonly string[]): boolean {
    const nextOrder = uniqueOrderFor(order, currentBlocks)
    if (ordersEqual(currentOrder, nextOrder)) return false

    currentOrder = nextOrder
    markOrderDirty()
    return true
  }

  function hasPending(): boolean {
    return dirtyGenerations.size > 0 || orderDirty
  }

  function prepare(): PreparedEditorBlockChanges | null {
    if (!hasPending()) return null

    const upserts: EditorSurfaceBlock[] = []
    const deletes: string[] = []
    const entries = new Map<string, PreparedBlockEntry>()

    for (const [blockId, blockGeneration] of dirtyGenerations) {
      const block = currentBlocks.get(blockId) ?? null
      entries.set(blockId, { block, generation: blockGeneration })

      const committed = committedBlocks.get(blockId)
      if (block === null) {
        if (committed) deletes.push(blockId)
      } else if (!committed || !blocksEqual(committed, block)) {
        upserts.push(block)
      }
    }

    const order = orderDirty ? [...currentOrder] : null
    const changes: EditorSurfaceBlockChangeSet = {}
    if (upserts.length > 0) changes.upserts = upserts
    if (deletes.length > 0) changes.deletes = deletes
    if (order) changes.order = order

    if (!changes.upserts && !changes.deletes && !changes.order) return null

    return {
      changes,
      entries,
      order,
      orderGeneration,
    }
  }

  function commit(prepared: PreparedEditorBlockChanges) {
    for (const [blockId, entry] of prepared.entries) {
      if (entry.block) committedBlocks.set(blockId, entry.block)
      else committedBlocks.delete(blockId)

      if (dirtyGenerations.get(blockId) === entry.generation) {
        dirtyGenerations.delete(blockId)
      }
    }

    if (prepared.order) {
      committedOrder = [...prepared.order]
      if (orderDirty && orderGeneration === prepared.orderGeneration) {
        orderDirty = false
      } else {
        orderDirty = !ordersEqual(currentOrder, committedOrder)
      }
    }
  }

  function current(): EditorSurfaceBlock[] {
    return currentOrder.flatMap((id) => {
      const block = currentBlocks.get(id)
      return block ? [block] : []
    })
  }

  return {
    upsert,
    remove,
    reorder,
    hasPending,
    prepare,
    commit,
    current,
  }
}
