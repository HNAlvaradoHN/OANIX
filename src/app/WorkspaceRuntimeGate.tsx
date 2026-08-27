import { EditorOperationRuntime } from '../features/editor/EditorOperationRuntime'
import '../features/editor/editorTrailingWorkspace.css'
import { FolderCreationRuntime } from '../features/folders/FolderCreationRuntime'
import { FolderMobileDragRuntime } from '../features/folders/FolderMobileDragRuntime'
import { FolderOperationFeedbackRuntime } from '../features/folders/FolderOperationFeedbackRuntime'
import { FolderScopedManagerRuntime } from '../features/folders/FolderScopedManagerRuntime'
import '../features/notes/folderDockContract.css'
import { NoteCreationFeedbackRuntime } from '../features/notes/NoteCreationFeedbackRuntime'
import { NoteVisualIdentityRuntime } from '../features/notes/NoteVisualIdentityRuntime'
import { OrganicWorkspaceRuntime } from '../features/notes/OrganicWorkspaceRuntime'
import { V383WorkspaceVisualRuntime } from '../features/notes/V383WorkspaceVisualRuntime'
import { WorkspacePersonalizationRuntime } from '../features/notes/WorkspacePersonalizationRuntime'
import '../features/privacy/noteBulkPrivacyOverrides.css'
import { PrivacyStatusHelp } from '../features/privacy/PrivacyStatusHelp'
import { TagCreationRuntime } from '../features/tags/TagCreationRuntime'
import { TagMobileGestureRuntime } from '../features/tags/TagMobileGestureRuntime'
import '../features/tags/tagTouchMotionGuard.css'
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
      <PrivacyStatusHelp />
      <WorkspaceQuickPolishRuntime />
      <FolderOperationFeedbackRuntime />
      <FolderCreationRuntime />
      <FolderMobileDragRuntime />
      <TagCreationRuntime />
      <TagMobileGestureRuntime />
      <V383WorkspaceVisualRuntime />
    </>
  )
}
