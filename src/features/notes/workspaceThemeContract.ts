import type { RefObject } from 'react'
import type { FolderIcon } from '../folders/folderAppearanceCatalog'
import type { FolderRecord } from '../folders/folderTypes'
import type { TagRecord } from '../tags/tagTypes'
import type { NoteListAppearanceInput } from './noteService'
import type { NoteRecord } from './noteTypes'

export interface WorkspaceThemeProps {
  folders: FolderRecord[]
  tags: TagRecord[]
  notes: NoteRecord[]
  visibleNotes: NoteRecord[]
  loading: boolean
  creating: boolean
  deletingId: string | null
  error: string
  selectedId: string | null
  activeFolderId: string | 'all'
  activeTagId: string | 'all'
  searchOpen: boolean
  searchQuery: string
  searchInputRef: RefObject<HTMLInputElement | null>
  workspaceMenuOpen: boolean
  backupBusy: boolean
  onSearchToggle: () => void
  onSearchQueryChange: (query: string) => void
  onClearSearch: () => void
  onLock: () => void
  onWorkspaceMenuToggle: () => void
  onOpenFolderManager: () => void
  onOpenTagManager: () => void
  onExportBackup: () => void
  onSelectFolder: (folderId: string | 'all') => void
  onSelectTag: (tagId: string | 'all') => void
  onCreateNote: () => void
  onSelectNote: (noteId: string) => void
  onTogglePinned: (note: NoteRecord) => void
  onOpenTagEditor: (note: NoteRecord) => void
  onOpenMoveNote: (note: NoteRecord) => void
  onDeleteNote: (note: NoteRecord) => void
  onCreateTag: (name: string, appearance: { icon: string; color: string }) => Promise<void>
  onDeleteTag: (tag: TagRecord) => Promise<void>
  onCreateFolder: (name: string, appearance: { icon: FolderIcon; color: string }) => Promise<void>
  onRenameFolder: (folder: FolderRecord, name: string) => Promise<void>
  onDeleteFolder: (folder: FolderRecord) => Promise<void>
  onCustomizeNote: (noteId: string, input: NoteListAppearanceInput) => Promise<void>
  onFolderOrder: (ids: string[]) => void
  onTagOrder: (ids: string[]) => void
  onNoteOrder: (ids: string[]) => void
}
