import { useEffect, useRef, type CSSProperties } from 'react'
import Sortable from 'sortablejs'
import type { FolderV2Record, TagV2Record } from './rebuildModel'
import { folderAccent, folderSurfaceCss } from './rebuildModel'
import './workspaceDrawer.css'

interface WorkspaceDrawerProps {
  open: boolean
  folders: FolderV2Record[]
  tags: TagV2Record[]
  activeFolderId: string | null
  activeTagId: string | null
  onClose: () => void
  onCreate: () => void
  onSelectAllFolders: () => void
  onSelectFolder: (folderId: string) => void
  onSelectTag: (tagId: string) => void
  onCustomizeFolder: (folderId: string) => void
  onCustomizeTag: (tagId: string) => void
  onReorderFolders: (orderedIds: string[]) => Promise<void>
  onReorderTags: (orderedIds: string[]) => Promise<void>
}

function readOrderedIds(node: HTMLElement): string[] {
  return Array.from(node.querySelectorAll<HTMLElement>('[data-workspace-item-id]'))
    .map((item) => item.dataset.workspaceItemId)
    .filter((id): id is string => Boolean(id))
}

function ordersMatch(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function createSortable(
  node: HTMLElement,
  group: string,
  onPersist: (orderedIds: string[]) => Promise<void>,
): Sortable {
  let orderBeforeDrag: string[] | null = null

  return Sortable.create(node, {
    animation: 160,
    delay: 320,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    handle: '[data-workspace-drag-handle]',
    draggable: '[data-workspace-item-id]',
    ghostClass: 'workspace-drawer__item--ghost',
    chosenClass: 'workspace-drawer__item--chosen',
    dragClass: 'workspace-drawer__item--dragging',
    group: { name: group, pull: false, put: false },
    onStart: () => {
      orderBeforeDrag = readOrderedIds(node)
    },
    onEnd: () => {
      const orderedIds = readOrderedIds(node)
      const previousOrder = orderBeforeDrag
      orderBeforeDrag = null

      // Sortable may finish a gesture without changing position. Avoid encrypting and
      // writing an order record when the persisted semantic value is unchanged.
      if (previousOrder && ordersMatch(previousOrder, orderedIds)) return
      void onPersist(orderedIds)
    },
  })
}

export function WorkspaceDrawer({
  open,
  folders,
  tags,
  activeFolderId,
  activeTagId,
  onClose,
  onCreate,
  onSelectAllFolders,
  onSelectFolder,
  onSelectTag,
  onCustomizeFolder,
  onCustomizeTag,
  onReorderFolders,
  onReorderTags,
}: WorkspaceDrawerProps) {
  const foldersRef = useRef<HTMLDivElement | null>(null)
  const tagsRef = useRef<HTMLDivElement | null>(null)
  const reorderFoldersRef = useRef(onReorderFolders)
  const reorderTagsRef = useRef(onReorderTags)
  const logoSrc = `${import.meta.env.BASE_URL}oanix-logo.webp`

  reorderFoldersRef.current = onReorderFolders
  reorderTagsRef.current = onReorderTags

  useEffect(() => {
    const foldersNode = foldersRef.current
    const tagsNode = tagsRef.current
    if (!foldersNode || !tagsNode) return

    const folderSortable = createSortable(
      foldersNode,
      'oanix-home-folders',
      (orderedIds) => reorderFoldersRef.current(orderedIds),
    )
    const tagSortable = createSortable(
      tagsNode,
      'oanix-home-tags',
      (orderedIds) => reorderTagsRef.current(orderedIds),
    )

    return () => {
      folderSortable.destroy()
      tagSortable.destroy()
    }
  }, [])

  return (
    <>
      {open && (
        <button
          className="rebuild-scrim"
          type="button"
          onClick={onClose}
          aria-label="Cerrar carpetas y etiquetas"
        />
      )}

      <aside
        className={`rebuild-drawer workspace-drawer${open ? ' is-open' : ''}`}
        aria-hidden={!open}
      >
        <header>
          <img className="workspace-drawer__logo" src={logoSrc} alt="OANIX" />
          <strong>OANIX</strong>
          <button
            className="workspace-drawer__create"
            type="button"
            onClick={onCreate}
            aria-label="Crear carpeta o etiqueta"
            title="Crear carpeta o etiqueta"
          >
            +
          </button>
          <button
            className="rebuild-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            data-oanix-back-close="true"
          >
            ×
          </button>
        </header>

        <div className="rebuild-drawer__columns">
          <section aria-label="Carpetas">
            <h3>Carpetas <small>{folders.length}</small></h3>
            <div className="rebuild-drawer__list workspace-drawer__list">
              <button
                type="button"
                className={`workspace-drawer__all${activeFolderId === null ? ' is-active' : ''}`}
                onClick={onSelectAllFolders}
              >
                <span aria-hidden="true">✨</span>
                <strong>Todas</strong>
              </button>
              <div ref={foldersRef} className="workspace-drawer__sortable">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`workspace-drawer__item${activeFolderId === folder.id ? ' is-active' : ''}`}
                    data-workspace-item-id={folder.id}
                    style={{
                      '--folder-accent': folderAccent(folder),
                      '--folder-soft': folderSurfaceCss(folder, .16),
                      '--folder-strong': folderSurfaceCss(folder),
                    } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="workspace-drawer__drag"
                      data-workspace-drag-handle
                      aria-label={`Mover ${folder.name}`}
                      title="Mantén y arrastra para mover"
                    >
                      ⋮⋮
                    </button>
                    <button
                      type="button"
                      className="workspace-drawer__select"
                      onClick={() => onSelectFolder(folder.id)}
                    >
                      <span className="workspace-drawer__folder-icon" aria-hidden="true">{folder.icon}</span>
                      <strong>{folder.name}</strong>
                      {(folder.pinned === true || folder.favorite === true) && (
                        <span className="workspace-drawer__marks" aria-label="Estado de carpeta">
                          {folder.pinned === true && <span title="Fijada" aria-label="Fijada">📌</span>}
                          {folder.favorite === true && <span title="Favorita" aria-label="Favorita">★</span>}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="workspace-drawer__edit"
                      onClick={() => onCustomizeFolder(folder.id)}
                      aria-label={`Personalizar ${folder.name}`}
                      title="Personalizar carpeta"
                    >
                      ⚙
                    </button>
                  </div>
                ))}
              </div>
              {folders.length === 0 && <p>No hay carpetas todavía.</p>}
            </div>
          </section>

          <section aria-label="Etiquetas">
            <h3>Etiquetas <small>{tags.length}</small></h3>
            <div ref={tagsRef} className="rebuild-drawer__list workspace-drawer__sortable">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className={`workspace-drawer__item workspace-drawer__item--tag${activeTagId === tag.id ? ' is-active' : ''}`}
                  data-workspace-item-id={tag.id}
                >
                  <button
                    type="button"
                    className="workspace-drawer__drag"
                    data-workspace-drag-handle
                    aria-label={`Mover ${tag.name}`}
                    title="Mantén y arrastra para mover"
                  >
                    ⋮⋮
                  </button>
                  <button
                    type="button"
                    className="workspace-drawer__select"
                    onClick={() => onSelectTag(tag.id)}
                  >
                    <i style={{ background: tag.color }} aria-hidden="true" />
                    <strong>{tag.name}</strong>
                  </button>
                  <button
                    type="button"
                    className="workspace-drawer__edit"
                    onClick={() => onCustomizeTag(tag.id)}
                    aria-label={`Personalizar ${tag.name}`}
                    title="Personalizar etiqueta"
                  >
                    ⚙
                  </button>
                </div>
              ))}
              {tags.length === 0 && <p>No hay etiquetas todavía.</p>}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}
