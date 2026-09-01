export interface EditorSurfaceSnapshot {
  title: string
  text: string
}

export type EditorSurfaceBlockValue =
  | null
  | boolean
  | number
  | string
  | EditorSurfaceBlockValue[]
  | { [key: string]: EditorSurfaceBlockValue }

export interface EditorSurfaceBlock {
  id: string
  kind: string
  data: { [key: string]: EditorSurfaceBlockValue }
}

export interface EditorSurfaceBlockChangeSet {
  upserts?: EditorSurfaceBlock[]
  deletes?: string[]
  order?: string[]
}

/**
 * Stable application boundary between OANIX and a visual editor implementation.
 *
 * A sheet/template may implement this contract, but it must not own persistence,
 * encryption, vault/session state, sync, navigation, or note identity. Those stay
 * above/below this visual boundary so replacing the sheet never migrates note data.
 *
 * Rich-block callbacks are optional because plain-text surfaces must remain cheap.
 * A rich-capable surface may request blocks only after it is mounted; opening a note
 * must not decrypt block payloads for a surface that does not use them.
 */
export interface EditorSurfaceProps {
  noteId: string
  initialTitle: string
  initialText: string
  saving: boolean
  error?: string
  onRequestSave: (snapshot: EditorSurfaceSnapshot) => Promise<boolean>
  onRequestClose: (snapshot: EditorSurfaceSnapshot | null) => Promise<boolean>
  loadBlocks?: () => Promise<EditorSurfaceBlock[]>
  onRequestBlockSave?: (changes: EditorSurfaceBlockChangeSet) => Promise<boolean>
  onActivity?: () => void
}

/**
 * Capability description for editor implementations. Keep this declarative: it
 * lets OANIX evolve richer block editors without making Home/storage depend on a
 * particular template or DOM engine.
 */
export interface EditorSurfaceCapabilities {
  plainText: boolean
  richBlocks: boolean
  attachments: boolean
}
