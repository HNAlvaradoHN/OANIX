export const MAX_TAG_NAME_LENGTH = 40

export const DEFAULT_TAG_ICON = '🏷️'
export const DEFAULT_TAG_COLOR = '#2563eb'

export const TAG_ICON_OPTIONS = [
  '🏷️', '📊', '🎨', '📈', '🚀', '⚡', '💡', '🔥',
  '💎', '🎵', '🎮', '📁', '💻', '🔑', '🧠', '🧩',
  '⚙️', '⭐', '📌', '🧪', '🛡️', '📚', '💬', '✅',
] as const

export const TAG_COLOR_OPTIONS = [
  '#2563eb', '#ec4899', '#10b981', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#ef4444', '#94a3b8',
] as const

export interface TagRecord {
  version: 1
  id: string
  name: string
  icon?: string
  color?: string
  createdAt: string
  updatedAt: string
}

export function normalizeTagName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('El nombre de la etiqueta no puede estar vacío.')
  if (name.length > MAX_TAG_NAME_LENGTH) {
    throw new Error(`El nombre de la etiqueta no puede superar ${MAX_TAG_NAME_LENGTH} caracteres.`)
  }
  return name
}

function isValidOptionalIcon(icon: unknown): boolean {
  return icon === undefined || (typeof icon === 'string' && icon.length > 0 && icon.length <= 16)
}

function isValidOptionalColor(color: unknown): boolean {
  return color === undefined || (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
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
    isValidOptionalIcon(tag.icon) &&
    isValidOptionalColor(tag.color) &&
    typeof tag.createdAt === 'string' &&
    typeof tag.updatedAt === 'string'
  )
}
