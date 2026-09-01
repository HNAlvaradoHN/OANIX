import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'
import { activeEditorSurface } from './editorSurfaceRegistry'

/**
 * Stable host for the active note editor surface.
 *
 * Home imports this host instead of a concrete sheet/template. The concrete
 * implementation is selected only by editorSurfaceRegistry, keeping persistence,
 * encryption, navigation and the Home workspace independent from visual sheets.
 */
export function EditorSurface(props: EditorSurfaceProps) {
  const ActiveSurface = activeEditorSurface.component
  return <ActiveSurface {...props} />
}

/** Capabilities of the currently selected surface implementation. */
export const editorSurfaceCapabilities: EditorSurfaceCapabilities =
  activeEditorSurface.capabilities
