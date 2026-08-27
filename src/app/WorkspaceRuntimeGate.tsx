import { EditorOperationRuntime } from '../features/editor/EditorOperationRuntime'
import '../features/editor/editorTrailingWorkspace.css'
import { FolderCreationRuntime } from '../features/folders/FolderCreationRuntime'
import { FolderMobileDragRuntime } from '../features/folders/FolderMobileDragRuntime'
import { FolderOperationFeedbackRuntime } from '../features/folders/FolderOperationFeedbackRuntime'
import { FolderScopedManagerRuntime } from '../features/folders/FolderScopedManagerRuntime'
import '../features/notes/folderDockContract.css'
import { NoteCreationFeedbackRuntime } from '../features/notes/NoteCreationFeedbackRuntime'
import { NoteMenuScrollDismiss } from '../features/notes/NoteMenuScrollDismiss'
import { NoteMenuViewportFit } from '../features/notes/NoteMenuViewportFit'
import { NoteVisualIdentityRuntime } from '../features/notes/NoteVisualIdentityRuntime'
import { OrganicWorkspaceRuntime } from '../features/notes/OrganicWorkspaceRuntime'
import { V383WorkspaceVisualRuntime } from '../features/notes/V383WorkspaceVisualRuntime'
import { WorkspaceInputCompatibilityRuntime } from '../features/notes/WorkspaceInputCompatibilityRuntime'
import { WorkspacePersonalizationRuntime } from '../features/notes/WorkspacePersonalizationRuntime'
import '../features/privacy/noteBulkPrivacyOverrides.css'
import { PrivacyStatusHelp } from '../features/privacy/PrivacyStatusHelp'
import { TagMobileGestureRuntime } from '../features/tags/TagMobileGestureRuntime'
import { WorkspaceQuickPolishRuntime } from './WorkspaceQuickPolishRuntime'

export function WorkspaceRuntimeGate() {
  return (
    <>
      <EditorOperationRuntime />
      <NoteCreationFeedbackRuntime />
      <FolderScopedManagerRuntime />
      <OrganicWorkspaceRuntime />
      <WorkspacePersonalizationRuntime />
      <NoteVisualIdentityRuntime />
      <NoteMenuScrollDismiss />
      <NoteMenuViewportFit />
      <WorkspaceInputCompatibilityRuntime />
      <PrivacyStatusHelp />
      <WorkspaceQuickPolishRuntime />
      <FolderOperationFeedbackRuntime />
      <FolderCreationRuntime />
      <FolderMobileDragRuntime />
      <TagMobileGestureRuntime />
      <V383WorkspaceVisualRuntime />
    </>
  )
}
