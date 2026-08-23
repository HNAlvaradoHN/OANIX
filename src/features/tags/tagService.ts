import {
  deleteTagRecord,
  listTags,
  readTag,
  readTagOrder,
  saveTag,
  saveTagOrder,
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

function alphabetical(tags: TagRecord[]): TagRecord[] {
  return [...tags].sort((left, right) =>
    left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
  )
}

function applyTagOrder(tags: TagRecord[], orderedIds: string[]): TagRecord[] {
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  const ordered: TagRecord[] = []
  const used = new Set<string>()

  for (const id of orderedIds) {
    const tag = byId.get(id)
    if (!tag || used.has(id)) continue
    used.add(id)
    ordered.push(tag)
  }

  ordered.push(...alphabetical(tags.filter((tag) => !used.has(tag.id))))
  return ordered
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
  const [tags, orderedIds] = await Promise.all([listTags(), readTagOrder()])
  return applyTagOrder(tags, orderedIds)
}

export async function createTag(name: string): Promise<TagRecord> {
  const existingTags = await loadTags()
  const now = new Date().toISOString()
  const tag: TagRecord = {
    version: 1,
    id: createTagId(),
    name: normalizeTagName(name),
    createdAt: now,
    updatedAt: now,
  }
  await saveTag(tag)
  await saveTagOrder([...existingTags.map((item) => item.id), tag.id])
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
      const orderedIds = await readTagOrder()
      await saveTagOrder(orderedIds.filter((id) => id !== tagId))
      return existing
    })

  mutationQueues.set(tagId, next)
  const cleanup = () => {
    if (mutationQueues.get(tagId) === next) mutationQueues.delete(tagId)
  }
  void next.then(cleanup, cleanup)
  return next
}

export async function persistTagOrder(tagIds: string[]): Promise<TagRecord[]> {
  const tags = await listTags()
  const existingIds = new Set(tags.map((tag) => tag.id))
  const uniqueRequested = [...new Set(tagIds)].filter((id) => existingIds.has(id))
  const requestedSet = new Set(uniqueRequested)
  const current = applyTagOrder(tags, await readTagOrder())
  const completeOrder = [
    ...uniqueRequested,
    ...current.filter((tag) => !requestedSet.has(tag.id)).map((tag) => tag.id),
  ]

  await saveTagOrder(completeOrder)
  return applyTagOrder(tags, completeOrder)
}
