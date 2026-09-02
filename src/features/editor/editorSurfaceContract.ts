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
 * Presentation-safe attachment metadata exposed to editor surfaces.
 *
 * The visual editor receives only opaque attachment identity + display metadata;
 * provider/storage details stay behind the application adapter. Binary payloads are
 * requested lazily and never embedded in rich-block JSON or note text.
 */
export interface EditorSurfaceAttachment {
  id: string
  name: string
  mimeType: string
  byteLength: number
  createdAt: string
  remote: boolean
}

/**
 * Stable application boundary between OANIX and a visual editor implementation.
 *
 * A sheet/template may implement this contract, but it must not own persistence,
 * encryption, vault/session state, sync, navigation, or note identity. Those stay
 * above/below this visual boundary so replacing the sheet never migrates note data.
 *
 * Rich-block and attachment callbacks are optional because surfaces that do not use
 * those capabilities must remain cheap. Attachment binaries are loaded only on an
 * explicit request from a capable surface; opening a normal text note never pulls
 * image/file bytes into RAM.
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
  loadAttachments?: () => Promise<EditorSurfaceAttachment[]>
  onRequestAttachmentStore?: (file: File) => Promise<EditorSurfaceAttachment>
  loadAttachmentFile?: (attachmentId: string) => Promise<File | null>
  onRequestAttachmentRemove?: (attachmentId: string) => Promise<boolean>
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
