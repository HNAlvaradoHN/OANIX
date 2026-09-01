import { NoteEditor } from '../NoteEditor'
import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from '../editorSurfaceContract'

/**
 * Transitional adapter for the already validated plain-text editor.
 *
 * Keeping it behind an implementation module prevents the future sheet from
 * importing or inheriting this editor's visual/runtime details. Replacing the
 * active sheet should only require changing the composition point in
 * EditorSurface, while Home and OANIX data/security layers remain untouched.
 */
export function PlainTextEditorSurface({
  noteId,
  initialTitle,
  initialText,
  saving,
  error,
  onRequestSave,
  onRequestClose,
  onActivity,
}: EditorSurfaceProps) {
  return (
    <NoteEditor
      noteId={noteId}
      initialTitle={initialTitle}
      initialText={initialText}
      saving={saving}
      error={error}
      onRequestSave={onRequestSave}
      onRequestClose={onRequestClose}
      onActivity={onActivity}
    />
  )
}

export const plainTextEditorSurfaceCapabilities: EditorSurfaceCapabilities = {
  plainText: true,
  richBlocks: false,
  attachments: false,
}
