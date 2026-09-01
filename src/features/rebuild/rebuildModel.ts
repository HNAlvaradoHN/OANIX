export const NOTE_V2_META_TYPE = 'note.v2.meta'
export const NOTE_V2_BODY_TYPE = 'note.v2.body'
export const NOTE_V2_MANIFEST_TYPE = 'note.v2.manifest'
export const NOTE_V2_TEXT_CHUNK_TYPE = 'note.v2.text-chunk'
export const NOTE_V2_BLOCK_MANIFEST_TYPE = 'note.v2.block-manifest'
export const NOTE_V2_BLOCK_TYPE = 'note.v2.block'
export const SYNC_V2_PENDING_TYPE = 'sync.v2.pending'
export const FOLDER_V2_TYPE = 'folder.v2'
export const TAG_V2_TYPE = 'tag.v2'

export const V2_FOLDER_GRADIENTS = [
  ['#7c5cff', '#ff6ec7'],
  ['#40c9ff', '#7c5cff'],
  ['#00d68f', '#40c9ff'],
  ['#ffb648', '#ff6ec7'],
  ['#ff4d6d', '#ff9d4d'],
  ['#8a8a92', '#3a3a46'],
  ['#ff7a59', '#ffb347'],
  ['#ffd166', '#f59e0b'],
  ['#34d399', '#16a34a'],
  ['#2dd4bf', '#06b6d4'],
  ['#60a5fa', '#2563eb'],
  ['#a78bfa', '#7c3aed'],
  ['#f472b6', '#db2777'],
  ['#fb7185', '#e11d48'],
  ['#c084fc', '#8b5cf6'],
  ['#94a3b8', '#475569'],
] as const

export const V2_FOLDER_ICONS = [
  '📁', '💼', '🎯', '💡', '🧠', '🔧', '📚', '🎨', '🏠',
  '💳', '✈️', '🧪', '⭐', '❤️', '🚀', '📷', '🎵', '🎮',
  '🍽️', '🏋️', '🛒', '💰', '🗓️', '🔒', '👥', '🐾', '🌱',
  '⚡', '🔥', '☕', '🎓', '🧳', '🩺', '📝', '📦', '🛠️',
] as const

export interface NoteV2Meta {
  version: 2
  revision: number
  id: string
  title: string
  folderId: string | null
  tagIds: string[]
  createdAt: string
  updatedAt: string
}

export interface NoteV2Body {
  version: 2
  noteId: string
  format: 'plain-text-v1'
  text: string
}

export interface NoteV2TextChunkRef {
  id: string
  length: number
  revision: number
}

export interface NoteV2Manifest {
  version: 2
  noteId: string
  format: 'chunked-text-v1'
  revision: number
  chunks: NoteV2TextChunkRef[]
}

export interface NoteV2TextChunk {
  version: 2
  noteId: string
  chunkId: string
  revision: number
  text: string
}

export type NoteV2BlockValue =
  | null
  | boolean
  | number
  | string
  | NoteV2BlockValue[]
  | { [key: string]: NoteV2BlockValue }

export interface NoteV2BlockRecord {
  version: 2
  noteId: string
  blockId: string
  revision: number
  kind: string
  data: { [key: string]: NoteV2BlockValue }
}

/**
 * Ordering is intentionally separated from block payloads. Editing one block only
 * rewrites that encrypted block; the manifest changes solely when topology/order does.
 */
export interface NoteV2BlockManifest {
  version: 2
  noteId: string
  format: 'blocks-v1'
  revision: number
  blockIds: string[]
}

export interface SyncV2PendingRecord {
  version: 2
  noteId: string
  unitType: string
  unitId: string
  revision: number
  operation: 'upsert' | 'delete'
  queuedAt: string
}

export interface FolderV2Record {
  version: 2
  id: string
  name: string
  icon: string
  gradientIndex: number
  customColor?: string | null
  coverAssetId?: string | null
  order?: number
  pinned?: boolean
  favorite?: boolean
  createdAt: string
  updatedAt: string
}

export interface TagV2Record {
  version: 2
  id: string
  name: string
  color: string
  order?: number
  createdAt: string
  updatedAt: string
}

export function folderGradient(index: number): readonly [string, string] {
  const normalized = Number.isSafeInteger(index)
    ? Math.abs(index) % V2_FOLDER_GRADIENTS.length
    : 0
  return V2_FOLDER_GRADIENTS[normalized]
}

function colorWithAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '')
  const value = Number.parseInt(raw, 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${red}, ${green}, ${blue}, ${a})`
}

export function folderGradientCss(index: number, alpha = 1): string {
  const [from, to] = folderGradient(index)
  if (alpha >= 1) return `linear-gradient(135deg, ${from}, ${to})`
  return `linear-gradient(135deg, ${colorWithAlpha(from, alpha)}, ${colorWithAlpha(to, alpha)})`
}

export function folderAccent(folder: FolderV2Record): string {
  return folder.customColor ?? folderGradient(folder.gradientIndex)[0]
}

export function folderSurfaceCss(folder: FolderV2Record, alpha = 1): string {
  if (!folder.customColor) return folderGradientCss(folder.gradientIndex, alpha)
  const color = alpha >= 1 ? folder.customColor : colorWithAlpha(folder.customColor, alpha)
  return `linear-gradient(135deg, ${color}, ${color})`
}
