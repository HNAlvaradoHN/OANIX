import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'

export const OANIX_FILE_GROUP_ELEMENT_KIND = 'oanix-file-group-element-v1'
export const MAX_OANIX_FILE_GROUP_ITEMS = 50
export const MAX_OANIX_FILE_GROUP_ATTACHMENT_ID_LENGTH = 180

export interface OanixFileGroupElement {
  id: string
  kind: typeof OANIX_FILE_GROUP_ELEMENT_KIND
  attachmentIds: string[]
}

function normalizeAttachmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const attachmentId = item.trim().slice(0, MAX_OANIX_FILE_GROUP_ATTACHMENT_ID_LENGTH)
    if (!attachmentId || seen.has(attachmentId)) continue
    seen.add(attachmentId)
    normalized.push(attachmentId)
    if (normalized.length >= MAX_OANIX_FILE_GROUP_ITEMS) break
  }

  return normalized
}

export function encodeOanixFileGroupElement(element: OanixFileGroupElement): EditorSurfaceBlock {
  return {
    id: element.id,
    kind: OANIX_FILE_GROUP_ELEMENT_KIND,
    data: {
      attachmentIds: normalizeAttachmentIds(element.attachmentIds),
    },
  }
}

export function decodeOanixFileGroupElement(block: EditorSurfaceBlock): OanixFileGroupElement | null {
  if (block.kind !== OANIX_FILE_GROUP_ELEMENT_KIND) return null
  return {
    id: block.id,
    kind: OANIX_FILE_GROUP_ELEMENT_KIND,
    attachmentIds: normalizeAttachmentIds(block.data.attachmentIds),
  }
}

export function createOanixFileGroupElement(attachmentIds: readonly string[]): OanixFileGroupElement {
  return {
    id: `oanix-file-group-${crypto.randomUUID()}`,
    kind: OANIX_FILE_GROUP_ELEMENT_KIND,
    attachmentIds: normalizeAttachmentIds([...attachmentIds]),
  }
}
