import type { AttachmentMetadata } from '../attachments/attachmentTypes'
import type { FolderRecord } from '../folders/folderTypes'
import type { StoredImageInfo } from '../images/imageService'
import type { TagRecord } from '../tags/tagTypes'
import type {
  ImageBlock,
  NoteRecord,
  NoteSheetAppearance,
  StoredNoteBlock,
} from './noteTypes'

export interface NoteSheetThemeProps {
  note: NoteRecord
  folders: FolderRecord[]
  tags: TagRecord[]
  draftTitle: string
  saveLabel: string
  deleting: boolean
  error: string
  onBack: () => void
  onDraftTitleChange: (value: string) => void
  onCommitTitle: () => Promise<void>
  onBlocksChange: (blocks: StoredNoteBlock[]) => void
  onFlush: () => Promise<boolean>
  onTogglePinned: () => Promise<void>
  onAddTag: (name: string) => Promise<void>
  onRemoveTag: (tagId: string) => Promise<void>
  onRenameTag: (tagId: string, name: string) => Promise<void>
  onMoveToFolder: (folderId: string | null) => Promise<void>
  onDeleteNote: () => Promise<void>
  onSaveAppearance: (appearance: NoteSheetAppearance) => Promise<void>
  onLoadImage: (block: ImageBlock) => Promise<Blob | null>
  onStoreImage: (file: File) => Promise<StoredImageInfo>
  onQueueImageRemoval: (imageId: string) => void
  onRestoreQueuedImage: (imageId: string) => void
  onLoadAttachments: () => Promise<AttachmentMetadata[]>
  onStoreAttachments: (files: File[]) => Promise<AttachmentMetadata[]>
  onRemoveAttachment: (attachment: AttachmentMetadata) => Promise<void>
  onOpenAttachment: (attachment: AttachmentMetadata) => Promise<void>
  onDownloadAttachment: (attachment: AttachmentMetadata) => Promise<void>
}
