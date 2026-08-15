import {
  deleteTagRecord,
  listTags,
  readTag,
  saveTag,
} from '../../storage/repositories/tagRepository'
import { normalizeTagName, type TagRecord } from './tagTypes'

const mutationQueues = new Map<string, Promise<unknown>>()

function createTagId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function sortTags(tags: TagRecord[]): TagRecord[] {
  return [...tags].sort((left, right) =>
    left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
  )
}

function enqueueTagMutation(
  tagId: string,
  mutate: (tag: TagRecord) => TagRecord,
): Promise<TagRecord> {
  const previous = mutationQueues.get(tagId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const existing = await readTag(tagId)
      if (!existing) throw new Error('La etiqueta ya no existe.')
      const updated = mutate(existing)
      await saveTag(updated)
      return updated
    })

  mutationQueues.set(tagId, next)
  const cleanup = () => {
    if (mutationQueues.get(tagId) === next) mutationQueues.delete(tagId)
  }
  void next.then(cleanup, cleanup)
  return next
}

export async function loadTags(): Promise<TagRecord[]> {
  return sortTags(await listTags())
}

export async function createTag(name: string): Promise<TagRecord> {
  const now = new Date().toISOString()
  const tag: TagRecord = {
    version: 1,
    id: createTagId(),
    name: normalizeTagName(name),
    createdAt: now,
    updatedAt: now,
  }
  await saveTag(tag)
  return tag
}

export function renameTag(tagId: string, name: string): Promise<TagRecord> {
  const normalizedName = normalizeTagName(name)
  return enqueueTagMutation(tagId, (existing) => ({
    ...existing,
    name: normalizedName,
    updatedAt: new Date().toISOString(),
  }))
}

export function deleteTag(tagId: string): Promise<TagRecord> {
  const previous = mutationQueues.get(tagId) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const existing = await readTag(tagId)
      if (!existing) throw new Error('La etiqueta ya no existe.')
      await deleteTagRecord(tagId)
      return existing
    })

  mutationQueues.set(tagId, next)
  const cleanup = () => {
    if (mutationQueues.get(tagId) === next) mutationQueues.delete(tagId)
  }
  void next.then(cleanup, cleanup)
  return next
}
