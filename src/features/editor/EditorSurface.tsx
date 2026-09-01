import { lazy, Suspense } from 'react'
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
 * Rich-block authority is capability-gated here. A plain-text implementation never
 * receives the loader/save callbacks, which prevents accidental block decryption or
 * persistence work while richBlocks is disabled.
 */
export function EditorSurface(props: EditorSurfaceProps) {
  const surfaceProps = activeEditorSurface.capabilities.richBlocks
    ? props
    : {
        ...props,
        loadBlocks: undefined,
        onRequestBlockSave: undefined,
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
