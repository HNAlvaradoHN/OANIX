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
 */
export function EditorSurface(props: EditorSurfaceProps) {
  return (
    <Suspense fallback={null}>
      <ActiveSurface {...props} />
    </Suspense>
  )
}

/** Capabilities of the currently selected surface implementation. */
export const editorSurfaceCapabilities: EditorSurfaceCapabilities =
  activeEditorSurface.capabilities
