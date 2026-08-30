import type { ReactNode } from 'react'
import type { FolderRecord } from '../folders/folderTypes'
import type { TagRecord } from '../tags/tagTypes'
import type { NoteRecord } from './noteTypes'

export interface NoteSheetThemeProps {
  note: NoteRecord
  folders: FolderRecord[]
  tags: TagRecord[]
  draftTitle: string
  saveLabel: string
  savingTitle: boolean
  deleting: boolean
  error: string
  editor: ReactNode
  onBack: () => void
  onDraftTitleChange: (value: string) => void
  onCommitTitle: () => void
  onTogglePinned: () => void
  onAddTag: (name: string) => Promise<void>
  onRemoveTag: (tagId: string) => Promise<void>
  onRenameTag: (tagId: string, name: string) => Promise<void>
  onMoveToFolder: (folderId: string | null) => Promise<void>
  onDeleteNote: () => void
  onRetrySave: () => void
}
