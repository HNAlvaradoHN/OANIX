import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'
import {
  activeEditorSurface,
  resolveEditorSurface,
  type EditorSurfaceId,
} from './editorSurfaceRegistry'

const ActiveSurface = lazy(activeEditorSurface.load)
const lazySurfaceCache = new Map<string, LazyExoticComponent<ComponentType<EditorSurfaceProps>>>()

function lazySurfaceFor(surfaceId?: EditorSurfaceId) {
  if (!surfaceId || surfaceId === activeEditorSurface.id) return ActiveSurface

  const definition = resolveEditorSurface(surfaceId)
  const cached = lazySurfaceCache.get(definition.id)
  if (cached) return cached

  const loaded = lazy(definition.load)
  lazySurfaceCache.set(definition.id, loaded)
  return loaded
}

export interface EditorSurfaceHostProps extends EditorSurfaceProps {
  /** Optional presentation-only selection. Note data is independent from this value. */
  surfaceId?: EditorSurfaceId
}

function attachmentCallbacks(noteId: string) {
  return {
    loadAttachments: async () => {
      const { createEditorAttachmentAdapter } = await import('./editorAttachmentAdapter')
      return createEditorAttachmentAdapter(noteId).load()
    },
    onRequestAttachmentStore: async (file: File) => {
      const { createEditorAttachmentAdapter } = await import('./editorAttachmentAdapter')
      return createEditorAttachmentAdapter(noteId).store(file)
    },
    loadAttachmentFile: async (attachmentId: string) => {
      const { createEditorAttachmentAdapter } = await import('./editorAttachmentAdapter')
      return createEditorAttachmentAdapter(noteId).loadFile(attachmentId)
    },
    onRequestAttachmentRemove: async (attachmentId: string) => {
      const { createEditorAttachmentAdapter } = await import('./editorAttachmentAdapter')
      return createEditorAttachmentAdapter(noteId).remove(attachmentId)
    },
  }
}

/**
 * Stable host for a note editor surface.
 *
 * Home imports this host instead of a concrete sheet/template. Concrete surfaces are
 * registered in editorSurfaceRegistry and loaded only when mounted. Selecting the
 * experimental replica changes presentation only; storage, crypto, navigation and
 * note identity continue through the same EditorSurfaceProps contract.
 *
 * Attachment access is capability-gated and dynamically imported. A surface without
 * attachment support never loads the attachment adapter or binary-storage path.
 */
export function EditorSurface({ surfaceId, ...props }: EditorSurfaceHostProps) {
  const selectedSurface = resolveEditorSurface(surfaceId)
  const SelectedSurface = lazySurfaceFor(surfaceId)
  const richProps = selectedSurface.capabilities.richBlocks
    ? props
    : {
        ...props,
        loadBlocks: undefined,
        onRequestBlockSave: undefined,
      }
  const surfaceProps: EditorSurfaceProps = selectedSurface.capabilities.attachments
    ? {
        ...richProps,
        ...attachmentCallbacks(props.noteId),
      }
    : {
        ...richProps,
        loadAttachments: undefined,
        onRequestAttachmentStore: undefined,
        loadAttachmentFile: undefined,
        onRequestAttachmentRemove: undefined,
      }

  return (
    <Suspense fallback={null}>
      <SelectedSurface {...surfaceProps} />
    </Suspense>
  )
}

/** Capabilities of the default surface retained for compatibility and diagnostics. */
export const editorSurfaceCapabilities: EditorSurfaceCapabilities =
  activeEditorSurface.capabilities
