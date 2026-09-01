import { useEffect, useMemo, useState } from 'react'
import type { FolderV2Record, TagV2Record } from './rebuildModel'
import { WorkspaceDrawer } from './WorkspaceDrawer'
import {
  WorkspaceCustomizationDialog,
  type WorkspaceCustomizationTarget,
  type WorkspaceFolderCustomization,
  type WorkspaceTagCustomization,
} from './WorkspaceCustomizationDialog'
import {
  customizeRebuildFolder,
  customizeRebuildTag,
  reorderRebuildFolders,
  reorderRebuildTags,
} from './workspaceCustomizationService'
import {
  removeWorkspaceFolderCover,
  replaceWorkspaceFolderCover,
} from './workspaceCoverAssignmentService'
import { readWorkspaceFolderCover } from './workspaceCoverService'

type CustomizationTarget =
  | { kind: 'folder'; id: string }
  | { kind: 'tag'; id: string }
  | null

interface WorkspaceHomeControllerProps {
  drawerOpen: boolean
  folders: FolderV2Record[]
  tags: TagV2Record[]
  activeFolderId: string | null
  activeTagId: string | null
  onCloseDrawer: () => void
  onCreate: () => void
  onSelectAllFolders: () => void
  onSelectFolder: (folderId: string) => void
  onSelectTag: (tagId: string) => void
  onFoldersChange: (folders: FolderV2Record[]) => void
  onTagsChange: (tags: TagV2Record[]) => void
  onDeleteFolder: (folderId: string) => Promise<void>
  onDeleteTag: (tagId: string) => Promise<void>
  onActiveCoverChange: (dataUrl: string | null) => void
  onError: (message: string) => void
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function WorkspaceHomeController({
  drawerOpen,
  folders,
  tags,
  activeFolderId,
  activeTagId,
  onCloseDrawer,
  onCreate,
  onSelectAllFolders,
  onSelectFolder,
  onSelectTag,
  onFoldersChange,
  onTagsChange,
  onDeleteFolder,
  onDeleteTag,
  onActiveCoverChange,
  onError,
}: WorkspaceHomeControllerProps) {
  const [target, setTarget] = useState<CustomizationTarget>(null)
  const [busy, setBusy] = useState(false)

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  )
  const tagById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag])),
    [tags],
  )
  const activeCoverAssetId = activeFolderId
    ? folderById.get(activeFolderId)?.coverAssetId ?? null
    : null

  const dialogTarget = useMemo(() => {
    if (!target) return null
    if (target.kind === 'folder') {
      const value = folderById.get(target.id)
      return value ? { kind: 'folder' as const, value, hasCover: Boolean(value.coverAssetId) } : null
    }
    const value = tagById.get(target.id)
    return value ? { kind: 'tag' as const, value } : null
  }, [target, folderById, tagById])

  useEffect(() => {
    let current = true
    onActiveCoverChange(null)

    if (!activeCoverAssetId) {
      return () => {
        current = false
      }
    }

    void readWorkspaceFolderCover(activeCoverAssetId)
      .then((dataUrl) => {
        if (current) onActiveCoverChange(dataUrl)
      })
      .catch((error) => {
        if (!current) return
        onActiveCoverChange(null)
        onError(errorMessage(error, 'No se pudo abrir el fondo de la carpeta.'))
      })

    return () => {
      current = false
    }
  }, [activeCoverAssetId, onActiveCoverChange, onError])

  async function reorderFolders(orderedIds: string[]) {
    try {
      const ordered = await reorderRebuildFolders(folders, orderedIds)
      onFoldersChange(ordered)
    } catch (error) {
      onError(errorMessage(error, 'No se pudo guardar el orden de las carpetas.'))
    }
  }

  async function reorderTags(orderedIds: string[]) {
    try {
      const ordered = await reorderRebuildTags(tags, orderedIds)
      onTagsChange(ordered)
    } catch (error) {
      onError(errorMessage(error, 'No se pudo guardar el orden de las etiquetas.'))
    }
  }

  async function saveFolder(folderId: string, input: WorkspaceFolderCustomization): Promise<boolean> {
    const folder = folderById.get(folderId)
    if (!folder || busy) return false
    setBusy(true)
    try {
      const updated = await customizeRebuildFolder(folder, input)
      onFoldersChange(folders.map((item) => item.id === folderId ? updated : item))
      return true
    } catch (error) {
      onError(errorMessage(error, 'No se pudo personalizar la carpeta.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveTag(tagId: string, input: WorkspaceTagCustomization): Promise<boolean> {
    const tag = tagById.get(tagId)
    if (!tag || busy) return false
    setBusy(true)
    try {
      const updated = await customizeRebuildTag(tag, input)
      onTagsChange(tags.map((item) => item.id === tagId ? updated : item))
      return true
    } catch (error) {
      onError(errorMessage(error, 'No se pudo personalizar la etiqueta.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function chooseCover(folderId: string, file: File): Promise<boolean> {
    const folder = folderById.get(folderId)
    if (!folder || busy) return false
    setBusy(true)
    try {
      const updated = await replaceWorkspaceFolderCover(folder, file)
      onFoldersChange(folders.map((item) => item.id === folderId ? updated : item))
      if (activeFolderId === folderId && updated.coverAssetId) {
        onActiveCoverChange(await readWorkspaceFolderCover(updated.coverAssetId))
      }
      return true
    } catch (error) {
      onError(errorMessage(error, 'No se pudo guardar el fondo de la carpeta.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function removeCover(folderId: string): Promise<boolean> {
    const folder = folderById.get(folderId)
    if (!folder || busy) return false
    setBusy(true)
    try {
      const updated = await removeWorkspaceFolderCover(folder)
      onFoldersChange(folders.map((item) => item.id === folderId ? updated : item))
      if (activeFolderId === folderId) onActiveCoverChange(null)
      return true
    } catch (error) {
      onError(errorMessage(error, 'No se pudo quitar el fondo de la carpeta.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function deleteTarget(current: WorkspaceCustomizationTarget): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    try {
      if (current.kind === 'folder') await onDeleteFolder(current.value.id)
      else await onDeleteTag(current.value.id)
      return true
    } catch (error) {
      onError(errorMessage(
        error,
        current.kind === 'folder'
          ? 'No se pudo eliminar la carpeta.'
          : 'No se pudo eliminar la etiqueta.',
      ))
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <WorkspaceDrawer
        open={drawerOpen}
        folders={folders}
        tags={tags}
        activeFolderId={activeFolderId}
        activeTagId={activeTagId}
        onClose={onCloseDrawer}
        onCreate={onCreate}
        onSelectAllFolders={onSelectAllFolders}
        onSelectFolder={onSelectFolder}
        onSelectTag={onSelectTag}
        onCustomizeFolder={(id) => setTarget({ kind: 'folder', id })}
        onCustomizeTag={(id) => setTarget({ kind: 'tag', id })}
        onReorderFolders={reorderFolders}
        onReorderTags={reorderTags}
      />
      <WorkspaceCustomizationDialog
        target={dialogTarget}
        busy={busy}
        onClose={() => setTarget(null)}
        onSaveFolder={saveFolder}
        onSaveTag={saveTag}
        onChooseFolderCover={chooseCover}
        onRemoveFolderCover={removeCover}
        onDelete={deleteTarget}
      />
    </>
  )
}
