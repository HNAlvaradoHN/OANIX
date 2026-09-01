import type {
  EditorSurfaceBlock,
  EditorSurfaceBlockValue,
} from './editorSurfaceContract.ts'

export const CHECKLIST_BLOCK_KIND = 'checklist'
export const MAX_CHECKLIST_ITEMS = 200
export const MAX_CHECKLIST_ITEM_TEXT_LENGTH = 2_000

export interface EditorChecklistItem {
  text: string
  checked: boolean
}

export interface EditorChecklistBlock {
  id: string
  kind: typeof CHECKLIST_BLOCK_KIND
  items: EditorChecklistItem[]
}

function isRecord(value: EditorSurfaceBlockValue | undefined): value is { [key: string]: EditorSurfaceBlockValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function decodeItem(value: EditorSurfaceBlockValue): EditorChecklistItem | null {
  if (!isRecord(value)) return null
  const { text, checked } = value
  if (typeof text !== 'string' || typeof checked !== 'boolean') return null
  if (text.length > MAX_CHECKLIST_ITEM_TEXT_LENGTH) return null
  return { text, checked }
}

/**
 * Decodes the generic editor block contract without accepting malformed or
 * unexpectedly large checklist payloads. Unknown block kinds remain untouched by
 * the editor and therefore stay forward-compatible with future rich block types.
 */
export function decodeChecklistBlock(block: EditorSurfaceBlock): EditorChecklistBlock | null {
  if (block.kind !== CHECKLIST_BLOCK_KIND) return null

  const itemsValue = block.data.items
  if (!Array.isArray(itemsValue) || itemsValue.length > MAX_CHECKLIST_ITEMS) return null

  const items: EditorChecklistItem[] = []
  for (const value of itemsValue) {
    const item = decodeItem(value)
    if (!item) return null
    items.push(item)
  }

  return {
    id: block.id,
    kind: CHECKLIST_BLOCK_KIND,
    items,
  }
}

export function encodeChecklistBlock(block: EditorChecklistBlock): EditorSurfaceBlock {
  return {
    id: block.id,
    kind: CHECKLIST_BLOCK_KIND,
    data: {
      items: block.items.map((item) => ({
        text: item.text,
        checked: item.checked,
      })),
    },
  }
}
