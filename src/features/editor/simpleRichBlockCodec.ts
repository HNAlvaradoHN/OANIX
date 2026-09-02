import type { EditorSurfaceBlock } from './editorSurfaceContract'

export const ENTRY_BLOCK_KIND = 'entry-v1'
export const CONTACT_BLOCK_KIND = 'contact-v1'
export const SEPARATOR_BLOCK_KIND = 'separator-v1'

export const MAX_ENTRY_TITLE_LENGTH = 120
export const MAX_ENTRY_TEXT_LENGTH = 8_000
export const MAX_CONTACT_NAME_LENGTH = 120
export const MAX_CONTACT_DETAIL_LENGTH = 240

export interface EditorEntryBlock {
  id: string
  kind: typeof ENTRY_BLOCK_KIND
  title: string
  text: string
  createdAt: string
}

export interface EditorContactBlock {
  id: string
  kind: typeof CONTACT_BLOCK_KIND
  name: string
  detail: string
}

export interface EditorSeparatorBlock {
  id: string
  kind: typeof SEPARATOR_BLOCK_KIND
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function encodeEntryBlock(block: EditorEntryBlock): EditorSurfaceBlock {
  return {
    id: block.id,
    kind: ENTRY_BLOCK_KIND,
    data: {
      title: block.title.slice(0, MAX_ENTRY_TITLE_LENGTH),
      text: block.text.slice(0, MAX_ENTRY_TEXT_LENGTH),
      createdAt: block.createdAt,
    },
  }
}

export function decodeEntryBlock(block: EditorSurfaceBlock): EditorEntryBlock | null {
  if (block.kind !== ENTRY_BLOCK_KIND) return null
  const title = readString(block.data.title)
  const text = readString(block.data.text)
  const createdAt = readString(block.data.createdAt)
  if (title === null || text === null || createdAt === null) return null
  return {
    id: block.id,
    kind: ENTRY_BLOCK_KIND,
    title: title.slice(0, MAX_ENTRY_TITLE_LENGTH),
    text: text.slice(0, MAX_ENTRY_TEXT_LENGTH),
    createdAt,
  }
}

export function encodeContactBlock(block: EditorContactBlock): EditorSurfaceBlock {
  return {
    id: block.id,
    kind: CONTACT_BLOCK_KIND,
    data: {
      name: block.name.slice(0, MAX_CONTACT_NAME_LENGTH),
      detail: block.detail.slice(0, MAX_CONTACT_DETAIL_LENGTH),
    },
  }
}

export function decodeContactBlock(block: EditorSurfaceBlock): EditorContactBlock | null {
  if (block.kind !== CONTACT_BLOCK_KIND) return null
  const name = readString(block.data.name)
  const detail = readString(block.data.detail)
  if (name === null || detail === null) return null
  return {
    id: block.id,
    kind: CONTACT_BLOCK_KIND,
    name: name.slice(0, MAX_CONTACT_NAME_LENGTH),
    detail: detail.slice(0, MAX_CONTACT_DETAIL_LENGTH),
  }
}

export function encodeSeparatorBlock(block: EditorSeparatorBlock): EditorSurfaceBlock {
  return { id: block.id, kind: SEPARATOR_BLOCK_KIND, data: {} }
}

export function decodeSeparatorBlock(block: EditorSurfaceBlock): EditorSeparatorBlock | null {
  if (block.kind !== SEPARATOR_BLOCK_KIND) return null
  return { id: block.id, kind: SEPARATOR_BLOCK_KIND }
}
