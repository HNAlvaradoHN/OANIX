import type { StoredNoteBlock } from '../notes/noteTypes'

export interface ProtectedBlockReconcileOptions {
  allowedRemovedIds?: ReadonlySet<string>
  mutableCodeIds?: ReadonlySet<string>
}

export interface ProtectedBlockReconcileResult {
  blocks: StoredNoteBlock[]
  repaired: boolean
}

function cloneBlock(block: StoredNoteBlock): StoredNoteBlock {
  return structuredClone(block)
}

function isProtectedBlock(block: StoredNoteBlock): boolean {
  return block.type === 'image' || block.type === 'code' || block.type === 'dailyEntry'
}

function stableInsertionIndex(
  previous: StoredNoteBlock[],
  previousIndex: number,
  result: StoredNoteBlock[],
): number {
  for (let index = previousIndex - 1; index >= 0; index -= 1) {
    const neighborIndex = result.findIndex((block) => block.id === previous[index].id)
    if (neighborIndex >= 0) return neighborIndex + 1
  }

  for (let index = previousIndex + 1; index < previous.length; index += 1) {
    const neighborIndex = result.findIndex((block) => block.id === previous[index].id)
    if (neighborIndex >= 0) return neighborIndex
  }

  return result.length
}

export function reconcileProtectedBlocks(
  previous: StoredNoteBlock[],
  next: StoredNoteBlock[],
  options: ProtectedBlockReconcileOptions = {},
): ProtectedBlockReconcileResult {
  const allowedRemovedIds = options.allowedRemovedIds ?? new Set<string>()
  const mutableCodeIds = options.mutableCodeIds ?? new Set<string>()
  const result = next.map(cloneBlock)
  let repaired = false

  previous.forEach((previousBlock, previousIndex) => {
    if (!isProtectedBlock(previousBlock) || allowedRemovedIds.has(previousBlock.id)) return

    const currentIndex = result.findIndex((block) => block.id === previousBlock.id)
    if (currentIndex < 0) {
      result.splice(stableInsertionIndex(previous, previousIndex, result), 0, cloneBlock(previousBlock))
      repaired = true
      return
    }

    const currentBlock = result[currentIndex]
    if (
      previousBlock.type === 'code' &&
      currentBlock.type === 'code' &&
      !mutableCodeIds.has(previousBlock.id) &&
      JSON.stringify(currentBlock) !== JSON.stringify(previousBlock)
    ) {
      result[currentIndex] = cloneBlock(previousBlock)
      repaired = true
    }
  })

  return { blocks: result, repaired }
}
