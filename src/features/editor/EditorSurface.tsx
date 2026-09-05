import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import type {
  EditorSurfaceBlock,
  EditorSurfaceBlockChangeSet,
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'
import { activeEditorSurface } from './editorSurfaceRegistry'
import {
  OanixTextLineRuntimeProvider,
  flushOanixTextLineEditors,
} from './oanixTextLineRuntime'

const ActiveSurface = lazy(activeEditorSurface.load)

function applyRuntimeBlockChanges(
  current: readonly EditorSurfaceBlock[],
  changes: EditorSurfaceBlockChangeSet,
): EditorSurfaceBlock[] {
  const deleted = new Set(changes.deletes ?? [])
  const upserts = new Map((changes.upserts ?? []).map((block) => [block.id, block]))
  const map = new Map<string, EditorSurfaceBlock>()
  const currentOrder: string[] = []

  for (const block of current) {
    if (deleted.has(block.id)) continue
    const next = upserts.get(block.id) ?? block
    map.set(next.id, next)
    currentOrder.push(next.id)
    upserts.delete(block.id)
  }

  for (const block of upserts.values()) {
    map.set(block.id, block)
    currentOrder.push(block.id)
  }

  const requested = changes.order?.filter((id, index, order) => map.has(id) && order.indexOf(id) === index)
  if (!requested || requested.length === 0) return currentOrder.map((id) => map.get(id)!)

  const containsEveryBlock = currentOrder.every((id) => requested.includes(id))
  if (containsEveryBlock && requested.length === currentOrder.length) {
    return requested.map((id) => map.get(id)!)
  }

  // A stale child surface must never be allowed to drop blocks that were already
  // committed by the live line editor. Preserve the authoritative runtime order
  // whenever an incoming order omits existing ids.
  return currentOrder.map((id) => map.get(id)!)
}

/**
 * Stable host for the active note editor surface.
 *
 * Home imports this host instead of a concrete sheet/template. The concrete
 * implementation is selected only by editorSurfaceRegistry and loaded on demand,
 * keeping persistence, encryption, navigation and the Home workspace independent
 * from visual sheets while avoiding editor work until a note is actually opened.
 *
 * Rich-block and attachment authority are capability-gated here. A plain-text
 * implementation receives neither block callbacks nor attachment callbacks, so the
 * currently approved sheet cannot accidentally enumerate/decrypt binary metadata
 * before its document anchoring model is ready.
 */
export function EditorSurface(props: EditorSurfaceProps) {
  const runtimeBlocksRef = useRef<EditorSurfaceBlock[] | null>(null)

  useEffect(() => {
    runtimeBlocksRef.current = null
  }, [props.noteId])

  const attachmentCallbacks = useMemo(() => {
    if (!activeEditorSurface.capabilities.attachments) return null
    const noteId = props.noteId

    return {
      loadAttachments: async () => {
        const { loadEditorSurfaceAttachments } = await import('./editorAttachmentAdapter')
        return loadEditorSurfaceAttachments(noteId)
      },
      onRequestAttachmentStore: async (file: File) => {
        const { storeEditorSurfaceAttachment } = await import('./editorAttachmentAdapter')
        return storeEditorSurfaceAttachment(noteId, file)
      },
      loadAttachmentFile: async (attachmentId: string) => {
        const { loadEditorSurfaceAttachmentFile } = await import('./editorAttachmentAdapter')
        return loadEditorSurfaceAttachmentFile(noteId, attachmentId)
      },
      onRequestAttachmentRemove: async (attachmentId: string) => {
        const { removeEditorSurfaceAttachment } = await import('./editorAttachmentAdapter')
        return removeEditorSurfaceAttachment(noteId, attachmentId)
      },
    }
  }, [props.noteId])

  const sourceLoadBlocks = activeEditorSurface.capabilities.richBlocks ? props.loadBlocks : undefined
  const sourceSaveBlocks = activeEditorSurface.capabilities.richBlocks ? props.onRequestBlockSave : undefined

  const runtimeBlockCallbacks = useMemo(() => {
    if (!sourceLoadBlocks || !sourceSaveBlocks) {
      return { loadBlocks: undefined, onRequestBlockSave: undefined }
    }

    const loadBlocks = async () => {
      if (runtimeBlocksRef.current) return runtimeBlocksRef.current.map((block) => block)
      const loaded = await sourceLoadBlocks()
      runtimeBlocksRef.current = loaded.map((block) => block)
      return loaded.map((block) => block)
    }

    const onRequestBlockSave = async (changes: EditorSurfaceBlockChangeSet) => {
      const current = runtimeBlocksRef.current ?? await sourceLoadBlocks()
      const next = applyRuntimeBlockChanges(current, changes)
      const requestedOrder = changes.order
      const safeChanges: EditorSurfaceBlockChangeSet = requestedOrder
        ? { ...changes, order: next.map((block) => block.id) }
        : changes
      const saved = await sourceSaveBlocks(safeChanges)
      if (saved) runtimeBlocksRef.current = next
      return saved
    }

    return { loadBlocks, onRequestBlockSave }
  }, [props.noteId, sourceLoadBlocks, sourceSaveBlocks])

  const richProps = activeEditorSurface.capabilities.richBlocks
    ? {
        ...props,
        loadBlocks: runtimeBlockCallbacks.loadBlocks,
        onRequestBlockSave: runtimeBlockCallbacks.onRequestBlockSave,
        onRequestClose: async (snapshot: Parameters<EditorSurfaceProps['onRequestClose']>[0]) => {
          if (!(await flushOanixTextLineEditors(props.noteId))) return false
          return props.onRequestClose(snapshot)
        },
      }
    : {
        ...props,
        loadBlocks: undefined,
        onRequestBlockSave: undefined,
      }

  const surfaceProps = attachmentCallbacks
    ? { ...richProps, ...attachmentCallbacks }
    : {
        ...richProps,
        loadAttachments: undefined,
        onRequestAttachmentStore: undefined,
        loadAttachmentFile: undefined,
        onRequestAttachmentRemove: undefined,
      }

  return (
    <OanixTextLineRuntimeProvider value={{
      noteId: props.noteId,
      loadBlocks: surfaceProps.loadBlocks,
      saveBlockChanges: surfaceProps.onRequestBlockSave,
    }}>
      <Suspense fallback={null}>
        <ActiveSurface {...surfaceProps} />
      </Suspense>
    </OanixTextLineRuntimeProvider>
  )
}

/** Capabilities of the currently selected surface implementation. */
export const editorSurfaceCapabilities: EditorSurfaceCapabilities =
  activeEditorSurface.capabilities
