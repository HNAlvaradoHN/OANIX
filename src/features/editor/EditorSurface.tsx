import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'
import {
  PlainTextEditorSurface,
  plainTextEditorSurfaceCapabilities,
} from './implementations/PlainTextEditorSurface'

/**
 * Single composition point for the active note editor surface.
 *
 * Home imports this host instead of a concrete sheet/template. Replacing the visual
 * editor therefore changes only this composition point, while persistence,
 * encryption, navigation and the Home workspace remain untouched.
 */
export function EditorSurface(props: EditorSurfaceProps) {
  return <PlainTextEditorSurface {...props} />
}

/** Capabilities of the currently selected surface implementation. */
export const editorSurfaceCapabilities: EditorSurfaceCapabilities =
  plainTextEditorSurfaceCapabilities
