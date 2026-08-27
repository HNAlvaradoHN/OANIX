import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { loadFolderColors } from '../folders/folderAppearanceService'
import { loadFolderCovers } from '../folders/folderCoverService'
import { loadFolders } from '../folders/folderService'
import type { FolderRecord } from '../folders/folderTypes'
import { loadTags, persistTagOrder } from '../tags/tagService'
import type { TagRecord } from '../tags/tagTypes'
import './organicWorkspace.css'

const TAG_LONG_PRESS_MS = 460
const TAG_MOVE_TOLERANCE = 12
const PRIVATE_UI_RELOAD_DEBOUNCE_MS = 48
const ORGANIC_WORKSPACE_TARGET_SELECTOR = '.notes-sidebar, .notes-list, .oanix-folder-rail__item, .tag-filter-button, .oanix-organic-tags-host'
const ORGANIC_WORKSPACE_TARGET_CLASS_NAMES = [
  'notes-sidebar',
  'notes-list',
  'oanix-folder-rail__item',
  'tag-filter-button',
  'oanix-organic-tags-host',
]

interface FolderVisualState {
  covers: Map<string, string>
  colors: Map<string, string>
}

const EMPTY_FOLDER_VISUALS: FolderVisualState = {
  covers: new Map(),
  colors: new Map(),
}

function nodeTouchesOrganicWorkspaceTargets(node: Node): boolean {
  if (!(node instanceof Element)) return false
  return node.matches(ORGANIC_WORKSPACE_TARGET_SELECTOR) || node.querySelector(ORGANIC_WORKSPACE_TARGET_SELECTOR) !== null
}

function mutationTouchesOrganicWorkspaceTargets(record: MutationRecord): boolean {
  if (record.type === 'childList') {
    if ([...record.addedNodes, ...record.removedNodes].some(nodeTouchesOrganicWorkspaceTargets)) return true
    const target = record.target
    return target instanceof Element && target.matches('.oanix-folder-rail__item, .tag-filter-button')
  }

  if (record.type !== 'attributes') return false
  const target = record.target
  if (!(target instanceof Element)) return false
  if (record.attributeName === 'aria-current') return target.matches('.tag-filter-button')
  if (record.attributeName !== 'class') return false

  if (ORGANIC_WORKSPACE_TARGET_CLASS_NAMES.some((className) => target.classList.contains(className))) {
    return true
  }

  const oldClasses = new Set((record.oldValue ?? '').split(/\s+/).filter(Boolean))
  return ORGANIC_WORKSPACE_TARGET_CLASS_NAMES.some((className) => oldClasses.has(className))
}

function moveTagAroundTarget(
  tags: TagRecord[],
  draggedId: string,
  targetId: string,
  placeAfter: boolean,
): TagRecord[] {
  if (draggedId === targetId) return tags
  const fromIndex = tags.findIndex((tag) => tag.id === draggedId)
  if (fromIndex < 0) return tags
  const next = [...tags]
  const [dragged] = next.splice(fromIndex, 1)
  const targetIndex = next.findIndex((tag) => tag.id === targetId)
  if (!dragged || targetIndex < 0) return tags
  next.splice(targetIndex + (placeAfter ? 1 : 0), 0, dragged)
  return next.every((tag, index) => tag.id === tags[index]?.id) ? tags : next
}

function moveTagOneStepTowardTarget(
  tags: TagRecord[],
  draggedId: string,
  targetId: string,
  placeAfter: boolean,
): TagRecord[] {
  const currentIndex = tags.findIndex((tag) => tag.id === draggedId)
  if (currentIndex < 0) return tags

  const desired = moveTagAroundTarget(tags, draggedId, targetId, placeAfter)
  if (desired === tags) return tags
  const desiredIndex = desired.findIndex((tag) => tag.id === draggedId)
  if (desiredIndex < 0 || desiredIndex === currentIndex) return tags

  const next = [...tags]
  const [dragged] = next.splice(currentIndex, 1)
  if (!dragged) return tags
  const direction = desiredIndex > currentIndex ? 1 : -1
  const insertionIndex = Math.max(0, Math.min(next.length, currentIndex + direction))
  next.splice(insertionIndex, 0, dragged)
  return next
}

function tagDropTargetAtX(
  host: HTMLElement | null,
  draggedId: string,
  clientX: number,
): { targetId: string; placeAfter: boolean } | null {
  const candidates = Array.from(host?.querySelectorAll<HTMLElement>('[data-oanix-organic-tag-id]') ?? [])
    .flatMap((element) => {
      const targetId = element.dataset.oanixOrganicTagId
      if (!targetId || targetId === draggedId) return []
      return [{ targetId, rect: element.getBoundingClientRect() }]
    })
    .sort((left, right) => left.rect.left - right.rect.left)

  if (candidates.length === 0) return null
  for (const candidate of candidates) {
    if (clientX < candidate.rect.left + candidate.rect.width / 2) {
      return { targetId: candidate.targetId, placeAfter: false }
    }
  }
  const last = candidates[candidates.length - 1]
  return last ? { targetId: last.targetId, placeAfter: true } : null
}

function clampTagDragX(host: HTMLElement | null, clientX: number): number {
  const controlsLeft = host?.querySelector<HTMLElement>('.oanix-organic-tags__controls')
    ?.getBoundingClientRect().left
  return controlsLeft === undefined ? clientX : Math.min(clientX, controlsLeft - 1)
}

function captureTagRects(host: HTMLElement | null): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>()
  host?.querySelectorAll<HTMLElement>('[data-oanix-organic-tag-id]').forEach((element) => {
    const tagId = element.dataset.oanixOrganicTagId
    if (tagId) rects.set(tagId, element.getBoundingClientRect())
  })
  return rects
}

const tagReflowAnimations = new WeakMap<HTMLElement, Animation>()

function animateTagReflow(host: HTMLElement | null, before: Map<string, DOMRect>, draggingId: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      host?.querySelectorAll<HTMLElement>('[data-oanix-organic-tag-id]').forEach((element) => {
        const tagId = element.dataset.oanixOrganicTagId
        if (!tagId || tagId === draggingId) return
        const previous = before.get(tagId)
        if (!previous) return
        const next = element.getBoundingClientRect()
        const deltaX = previous.left - next.left
        if (Math.abs(deltaX) < 1) return
        tagReflowAnimations.get(element)?.cancel()
        const animation = element.animate(
          [{ translate: `${deltaX}px 0` }, { translate: '0 0' }],
          { duration: 150, easing: 'cubic-bezier(.2,.75,.25,1)' },
        )
        tagReflowAnimations.set(element, animation)
        animation.addEventListener('finish', () => {
          if (tagReflowAnimations.get(element) === animation) tagReflowAnimations.delete(element)
        }, { once: true })
      })
    })
  })
}

function activeTagNameFromWorkspace(): string | null {
  const label = document.querySelector<HTMLElement>('.tag-filter-button span:nth-child(2)')?.textContent?.trim() ?? ''
  return !label || label === 'Todas las etiquetas' ? null : label
}

function selectWorkspaceTag(tagId: string | null) {
  window.dispatchEvent(new CustomEvent('oanix:select-workspace-tag', {
    detail: { tagId },
  }))
}

export function OrganicWorkspaceRuntime() {
  const [tagHost, setTagHost] = useState<HTMLElement | null>(null)
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [tags, setTags] = useState<TagRecord[]>([])
  const [activeTagName, setActiveTagName] = useState<string | null>(null)
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [folderVisuals, setFolderVisuals] = useState<FolderVisualState>(EMPTY_FOLDER_VISUALS)
  const [tagReorderMode, setTagReorderMode] = useState(false)
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null)
  const [tagOrderError, setTagOrderError] = useState('')
  const tagsRef = useRef<TagRecord[]>([])
  const tagHostRef = useRef<HTMLElement | null>(null)
  const draggingTagIdRef = useRef<string | null>(null)
  const foldersRef = useRef<FolderRecord[]>([])
  const pressTimerRef = useRef<number | null>(null)
  const pressPointerRef = useRef({ pointerId: -1, startX: 0, startY: 0, tagId: '', button: null as HTMLButtonElement | null })
  const dragStartOrderRef = useRef<string[]>([])
  const suppressTagClickRef = useRef<string | null>(null)
  const reloadTimerRef = useRef<number | null>(null)
  const pendingTagOrderRef = useRef<string[] | null>(null)
  const tagOrderPersistingRef = useRef(false)

  useEffect(() => {
    tagsRef.current = tags
  }, [tags])

  useEffect(() => {
    tagHostRef.current = tagHost
  }, [tagHost])

  function decorateWorkspace() {
    document.querySelectorAll<HTMLElement>('.oanix-folder-rail__item').forEach((item) => {
      if (item.classList.contains('oanix-folder-rail__item--all')) {
        item.dataset.oanixOrganicFolderName = 'Todas'
      } else if (item.dataset.oanixFolderId) {
        item.dataset.oanixOrganicFolderName = item.title.trim()
      }
    })

    setActiveTagName((current) => {
      const next = activeTagNameFromWorkspace()
      return current === next ? current : next
    })
  }

  function workspaceReorderActive() {
    return (
      document.documentElement.classList.contains('oanix-mobile-note-dragging')
      || document.documentElement.classList.contains('oanix-mobile-folder-dragging')
      || Boolean(document.querySelector('.oanix-folder-grid--drag-active, .oanix-organic-tags.is-reordering'))
    )
  }

  function scheduleWorkspaceDecorate() {
    if (workspaceReorderActive()) return
    window.requestAnimationFrame(() => {
      if (!workspaceReorderActive()) decorateWorkspace()
    })
  }

  async function reloadPrivateUiData() {
    if (!document.querySelector('.notes-sidebar')) return
    try {
      const [nextTags, folders, covers, colors] = await Promise.all([
        loadTags(),
        loadFolders(),
        loadFolderCovers(),
        loadFolderColors(),
      ])
      tagsRef.current = nextTags
      foldersRef.current = folders
      setTags(nextTags)
      setFolderVisuals({ covers, colors })
      setTagOrderError('')
      scheduleWorkspaceDecorate()
    } catch {
      // The runtime only paints private UI while an unlocked workspace exists.
    }
  }

  useEffect(() => {
    const ensureHost = () => {
      const sidebar = document.querySelector<HTMLElement>('.notes-sidebar')
      const list = sidebar?.querySelector<HTMLElement>('.notes-list') ?? null
      if (!sidebar || !list) {
        setWorkspaceReady(false)
        setTagHost(null)
        return
      }

      setWorkspaceReady(true)
      let host = sidebar.querySelector<HTMLElement>('.oanix-organic-tags-host') ?? null
      if (!host) {
        host = document.createElement('div')
        host.className = 'oanix-organic-tags-host'
        sidebar.insertBefore(host, list)
      }
      setTagHost((current) => current === host ? current : host)
    }

    const scheduleReload = () => {
      if (reloadTimerRef.current !== null) window.clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null
        void reloadPrivateUiData()
      }, PRIVATE_UI_RELOAD_DEBOUNCE_MS)
    }

    ensureHost()
    void reloadPrivateUiData()

    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    const observer = new MutationObserver((records) => {
      if (workspaceReorderActive() || !records.some(mutationTouchesOrganicWorkspaceTargets)) return
      ensureHost()
      scheduleWorkspaceDecorate()
    })
    if (workspace) {
      observer.observe(workspace, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-current'],
        attributeOldValue: true,
      })
    }

    const handleLocalChange = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { recordType?: unknown } | null
        : null
      if (detail?.recordType === 'note') return
      scheduleReload()
    }
    const handleConflictResolved = () => scheduleReload()
    const handleCommittedFolder = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { folderId?: unknown } | null
        : null
      if (typeof detail?.folderId !== 'string') return
      setActiveFolderId(detail.folderId === 'all' ? null : detail.folderId)
    }

    window.addEventListener('oanix:local-data-changed', handleLocalChange)
    window.addEventListener('oanix:conflict-resolved', handleConflictResolved)
    window.addEventListener('oanix:workspace-folder-committed', handleCommittedFolder)

    return () => {
      observer.disconnect()
      window.removeEventListener('oanix:local-data-changed', handleLocalChange)
      window.removeEventListener('oanix:conflict-resolved', handleConflictResolved)
      window.removeEventListener('oanix:workspace-folder-committed', handleCommittedFolder)
      if (reloadTimerRef.current !== null) window.clearTimeout(reloadTimerRef.current)
      if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current)
      document.querySelector('.oanix-organic-tags-host')?.remove()
    }
  }, [])

  const activeFolderCover = activeFolderId ? folderVisuals.covers.get(activeFolderId) ?? '' : ''
  const activeFolderColor = activeFolderId ? folderVisuals.colors.get(activeFolderId) ?? '#1e293b' : '#e2e8f0'
  const activeFolderName = useMemo(
    () => activeFolderId ? foldersRef.current.find((folder) => folder.id === activeFolderId)?.name ?? '' : '',
    [activeFolderId, folderVisuals],
  )

  function queueTagOrderPersistence(nextOrder: string[]) {
    pendingTagOrderRef.current = [...nextOrder]
    if (tagOrderPersistingRef.current) return

    tagOrderPersistingRef.current = true
    void (async () => {
      try {
        while (pendingTagOrderRef.current) {
          const orderToPersist = pendingTagOrderRef.current
          pendingTagOrderRef.current = null
          try {
            const persisted = await persistTagOrder(orderToPersist)
            if (pendingTagOrderRef.current) continue
            const currentIds = tagsRef.current.map((tag) => tag.id)
            const stillMatchesPersistedOrder = currentIds.length === orderToPersist.length
              && currentIds.every((id, index) => id === orderToPersist[index])
            if (stillMatchesPersistedOrder) {
              tagsRef.current = persisted
              setTags(persisted)
            }
          } catch {
            setTagOrderError('No se pudo guardar el nuevo orden de etiquetas.')
            if (!pendingTagOrderRef.current) void reloadPrivateUiData()
          }
        }
      } finally {
        tagOrderPersistingRef.current = false
        if (pendingTagOrderRef.current) queueTagOrderPersistence(pendingTagOrderRef.current)
      }
    })()
  }

  function clearTagPress() {
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current)
    pressTimerRef.current = null
    pressPointerRef.current = { pointerId: -1, startX: 0, startY: 0, tagId: '', button: null }
  }

  function beginTagPointerDown(tag: TagRecord, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    clearTagPress()
    const button = event.currentTarget
    pressPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tagId: tag.id,
      button,
    }
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null
      suppressTagClickRef.current = tag.id
      dragStartOrderRef.current = tagsRef.current.map((item) => item.id)
      draggingTagIdRef.current = tag.id
      setTagReorderMode(true)
      setDraggingTagId(tag.id)
      try { button.setPointerCapture(event.pointerId) } catch { /* best effort */ }
      if ('vibrate' in navigator) navigator.vibrate?.(18)
    }, TAG_LONG_PRESS_MS)
  }

  function advanceTagDragAtX(draggedId: string, clientX: number) {
    const host = tagHostRef.current
    const dropTarget = tagDropTargetAtX(host, draggedId, clampTagDragX(host, clientX))
    if (!dropTarget) return

    const current = tagsRef.current
    const next = moveTagOneStepTowardTarget(current, draggedId, dropTarget.targetId, dropTarget.placeAfter)
    if (next === current) return

    const before = captureTagRects(host)
    tagsRef.current = next
    setTags(next)
    animateTagReflow(host, before, draggedId)
  }

  function handleTagPointerMove(tag: TagRecord, event: ReactPointerEvent<HTMLButtonElement>) {
    const press = pressPointerRef.current
    if (pressTimerRef.current !== null && press.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > TAG_MOVE_TOLERANCE) clearTagPress()
      return
    }
    if (draggingTagId !== tag.id) return
    event.preventDefault()
    advanceTagDragAtX(tag.id, event.clientX)
  }

  useEffect(() => {
    const handleEdgeTick = (event: Event) => {
      const draggedId = draggingTagIdRef.current
      const detail = event instanceof CustomEvent ? event.detail as { clientX?: unknown } | null : null
      if (!draggedId || typeof detail?.clientX !== 'number') return
      advanceTagDragAtX(draggedId, detail.clientX)
    }

    window.addEventListener('oanix:tag-reorder-edge-tick', handleEdgeTick)
    return () => window.removeEventListener('oanix:tag-reorder-edge-tick', handleEdgeTick)
  }, [])

  function finishTagDrag(tag: TagRecord, event: ReactPointerEvent<HTMLButtonElement>) {
    clearTagPress()
    if (draggingTagId !== tag.id) return
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch { /* best effort */ }

    draggingTagIdRef.current = null
    setDraggingTagId(null)
    setTagReorderMode(false)
    const before = dragStartOrderRef.current
    const nextIds = tagsRef.current.map((item) => item.id)
    if (before.length === nextIds.length && before.every((id, index) => id === nextIds[index])) return

    setTagOrderError('')
    queueTagOrderPersistence(nextIds)
  }

  function cancelTagDrag(tag: TagRecord, event: ReactPointerEvent<HTMLButtonElement>) {
    clearTagPress()
    if (draggingTagId !== tag.id) return
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch { /* best effort */ }
    const rank = new Map(dragStartOrderRef.current.map((id, index) => [id, index]))
    const restored = [...tagsRef.current].sort((left, right) => (rank.get(left.id) ?? 9999) - (rank.get(right.id) ?? 9999))
    tagsRef.current = restored
    setTags(restored)
    setDraggingTagId(null)
    setTagReorderMode(false)
  }

  function handleTagClick(tag: TagRecord) {
    if (suppressTagClickRef.current === tag.id) {
      suppressTagClickRef.current = null
      return
    }
    if (!tagReorderMode) selectWorkspaceTag(tag.id)
  }

  const backgroundStyle = {
    '--oanix-organic-folder-color': activeFolderColor,
    ...(activeFolderCover ? { '--oanix-organic-cover-image': `url("${activeFolderCover.replace(/"/g, '\\"')}")` } : {}),
  } as CSSProperties

  return (
    <>
      {workspaceReady && createPortal(
        <div
          className={`oanix-organic-background${activeFolderCover ? ' oanix-organic-background--covered' : ''}`}
          style={backgroundStyle}
          aria-hidden="true"
        />,
        document.body,
      )}

      {workspaceReady && createPortal(
        <div className="oanix-organic-folder-controls" aria-label="Acciones de carpetas">
          <button
            className="oanix-organic-folder-control oanix-organic-folder-control--add"
            type="button"
            onClick={() => document.querySelector<HTMLButtonElement>('.oanix-folder-rail__item--add')?.click()}
            aria-label="Crear o administrar carpetas"
            title="Carpetas"
          >
            ＋
          </button>
          <button
            className="oanix-organic-folder-control"
            type="button"
            disabled={!activeFolderId}
            onClick={() => {
              if (!activeFolderId) return
              window.dispatchEvent(new CustomEvent('oanix:open-folder-customizer', {
                detail: { folderId: activeFolderId },
              }))
            }}
            aria-label={activeFolderName ? `Opciones de ${activeFolderName}` : 'Opciones de carpeta'}
            title="Opciones de carpeta"
          >
            ⋮
          </button>
        </div>,
        document.body,
      )}

      {tagHost && createPortal(
        <div className={`oanix-organic-tags${tagReorderMode ? ' is-reordering' : ''}`}>
          <div className="oanix-organic-tags__scroll">
            <button
              className={`oanix-organic-tag-chip${activeTagName === null ? ' is-active' : ''}`}
              type="button"
              onClick={() => selectWorkspaceTag(null)}
              disabled={tagReorderMode}
            >
              Todas
            </button>
            {tags.map((tag) => (
              <button
                className={`oanix-organic-tag-chip${activeTagName === tag.name ? ' is-active' : ''}${draggingTagId === tag.id ? ' is-dragging' : ''}`}
                type="button"
                key={tag.id}
                data-oanix-organic-tag-id={tag.id}
                onClick={() => handleTagClick(tag)}
                onPointerDown={(event) => beginTagPointerDown(tag, event)}
                onPointerMove={(event) => handleTagPointerMove(tag, event)}
                onPointerUp={(event) => finishTagDrag(tag, event)}
                onPointerCancel={(event) => cancelTagDrag(tag, event)}
                onContextMenu={(event) => event.preventDefault()}
                aria-label={tagReorderMode ? `Mover etiqueta ${tag.name}` : `Filtrar por ${tag.name}`}
              >
                #{tag.name}
              </button>
            ))}
          </div>
          <div className="oanix-organic-tags__controls">
            <span className="oanix-organic-tags__arrows" aria-hidden="true">‹‹</span>
            <button
              type="button"
              onClick={() => document.querySelector<HTMLButtonElement>('.notes-tag-filter button[aria-label="Administrar etiquetas"]')?.click()}
              aria-label="Administrar etiquetas"
              title="Etiquetas"
            >
              ＋
            </button>
          </div>
          {tagOrderError && <span className="oanix-organic-tags__error" role="alert">{tagOrderError}</span>}
        </div>,
        tagHost,
      )}
    </>
  )
}
