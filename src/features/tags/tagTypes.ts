export interface TagRecord {
  version: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export const MAX_TAG_NAME_LENGTH = 40

export function normalizeTagName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('El nombre de la etiqueta no puede estar vacío.')
  if (name.length > MAX_TAG_NAME_LENGTH) {
    throw new Error(`El nombre de la etiqueta no puede superar ${MAX_TAG_NAME_LENGTH} caracteres.`)
  }
  return name
}

export function isTagRecord(value: unknown): value is TagRecord {
  if (!value || typeof value !== 'object') return false
  const tag = value as Partial<TagRecord>
  return (
    tag.version === 1 &&
    typeof tag.id === 'string' &&
    tag.id.length > 0 &&
    typeof tag.name === 'string' &&
    tag.name.length > 0 &&
    tag.name.length <= MAX_TAG_NAME_LENGTH &&
    tag.name === tag.name.trim() &&
    typeof tag.createdAt === 'string' &&
    typeof tag.updatedAt === 'string'
  )
}
