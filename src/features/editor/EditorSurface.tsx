import { NoteEditor } from './NoteEditor'
import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'

/**
 * Single composition point for the active note editor surface.
 *
 * Home imports this host instead of a concrete sheet/template. Replacing the visual
 * editor therefore changes this module (and the implementation it selects), while
 * persistence, encryption, navigation and the Home workspace remain untouched.
 */
export function EditorSurface(props: EditorSurfaceProps) {
  return <NoteEditor {...props} />
}

/** Capabilities of the currently selected surface implementation. */
export const editorSurfaceCapabilities: EditorSurfaceCapabilities = {
  plainText: true,
  richBlocks: false,
  attachments: false,
}
