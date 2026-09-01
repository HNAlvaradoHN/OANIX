export interface EditorSurfaceSnapshot {
  title: string
  text: string
}

/**
 * Stable application boundary between OANIX and a visual editor implementation.
 *
 * A sheet/template may implement this contract, but it must not own persistence,
 * encryption, vault/session state, sync, navigation, or note identity. Those stay
 * above/below this visual boundary so replacing the sheet never migrates note data.
 */
export interface EditorSurfaceProps {
  noteId: string
  initialTitle: string
  initialText: string
  saving: boolean
  error?: string
  onRequestSave: (snapshot: EditorSurfaceSnapshot) => Promise<boolean>
  onRequestClose: (snapshot: EditorSurfaceSnapshot | null) => Promise<boolean>
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
