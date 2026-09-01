import type { FolderV2Record } from './rebuildModel'
import { customizeRebuildFolder } from './workspaceCustomizationService'
import {
  deleteWorkspaceFolderCover,
  saveWorkspaceFolderCover,
} from './workspaceCoverService'

async function deleteCoverBestEffort(assetId: string | null | undefined) {
  if (!assetId) return
  try {
    await deleteWorkspaceFolderCover(assetId)
  } catch {
    // The folder pointer is authoritative. A failed cleanup must not roll back
    // a successfully persisted folder change or destroy the newly selected cover.
  }
}

export async function replaceWorkspaceFolderCover(
  folder: FolderV2Record,
  file: File,
): Promise<FolderV2Record> {
  const previousAssetId = folder.coverAssetId ?? null
  const nextAssetId = await saveWorkspaceFolderCover(file)

  try {
    const updated = await customizeRebuildFolder(folder, { coverAssetId: nextAssetId })
    if (previousAssetId && previousAssetId !== nextAssetId) {
      await deleteCoverBestEffort(previousAssetId)
    }
    return updated
  } catch (error) {
    await deleteCoverBestEffort(nextAssetId)
    throw error
  }
}

export async function removeWorkspaceFolderCover(
  folder: FolderV2Record,
): Promise<FolderV2Record> {
  const previousAssetId = folder.coverAssetId ?? null
  if (!previousAssetId) return folder

  const updated = await customizeRebuildFolder(folder, { coverAssetId: null })
  await deleteCoverBestEffort(previousAssetId)
  return updated
}
