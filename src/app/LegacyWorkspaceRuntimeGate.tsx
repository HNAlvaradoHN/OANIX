import { FolderCreationRuntime } from '../features/folders/FolderCreationRuntime'
import { FolderGridRuntime } from '../features/folders/FolderGridRuntime'
import { FolderMobileDragRuntime } from '../features/folders/FolderMobileDragRuntime'
import { FolderOperationFeedbackRuntime } from '../features/folders/FolderOperationFeedbackRuntime'
import { FolderScopedManagerRuntime } from '../features/folders/FolderScopedManagerRuntime'
import { V383WorkspaceVisualRuntime } from '../features/notes/V383WorkspaceVisualRuntime'
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
