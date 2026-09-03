import { lazy, Suspense, useMemo } from 'react'
import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'
import { activeEditorSurface } from './editorSurfaceRegistry'

const ActiveSurface = lazy(activeEditorSurface.load)

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

  const richProps = activeEditorSurface.capabilities.richBlocks
    ? props
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
    <Suspense fallback={null}>
      <ActiveSurface {...surfaceProps} />
    </Suspense>
  )
}

/** Capabilities of the currently selected surface implementation. */
export const editorSurfaceCapabilities: EditorSurfaceCapabilities =
  activeEditorSurface.capabilities
