export interface FolderRecord {
  version: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export const MAX_FOLDER_NAME_LENGTH = 60

export function normalizeFolderName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('El nombre de la carpeta no puede estar vacío.')
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    throw new Error(`El nombre de la carpeta no puede superar ${MAX_FOLDER_NAME_LENGTH} caracteres.`)
  }
  return name
}

export function isFolderRecord(value: unknown): value is FolderRecord {
  if (!value || typeof value !== 'object') return false
  const folder = value as Partial<FolderRecord>
  return (
    folder.version === 1 &&
    typeof folder.id === 'string' &&
    folder.id.length > 0 &&
    typeof folder.name === 'string' &&
    folder.name.length > 0 &&
    folder.name.length <= MAX_FOLDER_NAME_LENGTH &&
    folder.name === folder.name.trim() &&
    typeof folder.createdAt === 'string' &&
    typeof folder.updatedAt === 'string'
  )
}

export function applyFolderOrder(folders: FolderRecord[], orderedIds: string[]): FolderRecord[] {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  return [...folders].sort((left, right) => {
    const leftRank = rank.get(left.id)
    const rightRank = rank.get(right.id)
    if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank
    if (leftRank !== undefined) return -1
    if (rightRank !== undefined) return 1
    return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
  })
}

export function moveFolderId(
  orderedIds: string[],
  folderId: string,
  direction: 'up' | 'down',
): string[] {
  const currentIndex = orderedIds.indexOf(folderId)
  if (currentIndex < 0) return [...orderedIds]
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= orderedIds.length) return [...orderedIds]

  const next = [...orderedIds]
  ;[next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]]
  return next
}
