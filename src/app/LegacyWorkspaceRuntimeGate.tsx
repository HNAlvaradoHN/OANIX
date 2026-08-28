import { FolderCreationRuntime } from '../features/folders/FolderCreationRuntime'
import { FolderGridRuntime } from '../features/folders/FolderGridRuntime'
import { FolderMobileDragRuntime } from '../features/folders/FolderMobileDragRuntime'
import { FolderOperationFeedbackRuntime } from '../features/folders/FolderOperationFeedbackRuntime'
import { FolderScopedManagerRuntime } from '../features/folders/FolderScopedManagerRuntime'
import '../features/folders/folderNavigationState.css'
// Preserve the legacy cascade order inside the lazy fallback chunk. These files
// are scoped to html.oanix-v383-visual and are not needed by Workspace V2.
import '../features/editor/editorTrailingWorkspace.css'
import { V383WorkspaceVisualRuntime } from '../features/notes/V383WorkspaceVisualRuntime'
import '../features/notes/compactNoteContract.css'
import '../features/notes/responsiveCompactNoteContract.css'
import '../features/notes/organicWorkspaceTouchMotion.css'
import '../features/notes/folderDockContract.css'
import { NoteListReorderGestureRuntime } from '../features/notes/NoteListReorderGestureRuntime'
import { NoteMenuScrollDismiss } from '../features/notes/NoteMenuScrollDismiss'
import { NoteMenuViewportFit } from '../features/notes/NoteMenuViewportFit'
import { NoteVisualIdentityRuntime } from '../features/notes/NoteVisualIdentityRuntime'
import { OrganicWorkspaceRuntime } from '../features/notes/OrganicWorkspaceRuntime'
import { WorkspaceInputCompatibilityRuntime } from '../features/notes/WorkspaceInputCompatibilityRuntime'
import { WorkspacePersonalizationRuntime } from '../features/notes/WorkspacePersonalizationRuntime'
import { TagMobileGestureRuntime } from '../features/tags/TagMobileGestureRuntime'
import { WorkspaceQuickPolishRuntime } from './WorkspaceQuickPolishRuntime'

interface LegacyWorkspaceRuntimeGateProps {
  workspaceRevision: number
}

export function LegacyWorkspaceRuntimeGate({
  workspaceRevision,
}: LegacyWorkspaceRuntimeGateProps) {
  return (
    <>
      <FolderScopedManagerRuntime />
      <OrganicWorkspaceRuntime />
      <WorkspacePersonalizationRuntime />
      <NoteVisualIdentityRuntime />
      <NoteMenuScrollDismiss />
      <NoteMenuViewportFit />
      <WorkspaceInputCompatibilityRuntime />
      <WorkspaceQuickPolishRuntime />
      <FolderOperationFeedbackRuntime />
      <FolderCreationRuntime />
      <FolderMobileDragRuntime />
      <TagMobileGestureRuntime />
      <V383WorkspaceVisualRuntime />
      <NoteListReorderGestureRuntime key={`note-reorder-${workspaceRevision}`} />
      <FolderGridRuntime />
    </>
  )
}
