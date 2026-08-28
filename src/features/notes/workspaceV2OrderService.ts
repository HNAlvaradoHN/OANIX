import { persistFolderOrder } from '../folders/folderService'
import { persistTagOrder } from '../tags/tagService'
import { persistNoteOrder } from './noteService'
import type { FolderRecord } from '../folders/folderTypes'
import type { TagRecord } from '../tags/tagTypes'
import type { NoteRecord } from './noteTypes'

export function saveWorkspaceV2FolderOrder(ids: string[]): Promise<FolderRecord[]> {
  return persistFolderOrder(ids)
}

export function saveWorkspaceV2TagOrder(ids: string[]): Promise<TagRecord[]> {
  return persistTagOrder(ids)
}

export function saveWorkspaceV2NoteOrder(
  ids: string[],
  shouldContinue: () => boolean = () => true,
): Promise<NoteRecord[]> {
  return persistNoteOrder(ids, shouldContinue)
}
