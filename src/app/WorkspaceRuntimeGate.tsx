import { EditorOperationRuntime } from '../features/editor/EditorOperationRuntime'
import '../features/editor/editorTrailingWorkspace.css'
import { FolderAppearanceRuntime } from '../features/folders/FolderAppearanceRuntime'
import { FolderCreationRuntime } from '../features/folders/FolderCreationRuntime'
import { FolderCustomizerBridgeRuntime } from '../features/folders/FolderCustomizerBridgeRuntime'
import { FolderMobileDragRuntime } from '../features/folders/FolderMobileDragRuntime'
import { FolderOperationFeedbackRuntime } from '../features/folders/FolderOperationFeedbackRuntime'
import '../features/notes/folderDockContract.css'
import { NoteCreationFeedbackRuntime } from '../features/notes/NoteCreationFeedbackRuntime'
import { OrganicWorkspaceRuntime } from '../features/notes/OrganicWorkspaceRuntime'
import { V383WorkspaceVisualRuntime } from '../features/notes/V383WorkspaceVisualRuntime'
import { WorkspacePersonalizationRuntime } from '../features/notes/WorkspacePersonalizationRuntime'
import { PrivacyStatusHelp } from '../features/privacy/PrivacyStatusHelp'
import { TagCreationRuntime } from '../features/tags/TagCreationRuntime'
import { TagMobileGestureRuntime } from '../features/tags/TagMobileGestureRuntime'

export function WorkspaceRuntimeGate() {
  return (
    <>
      <EditorOperationRuntime />
      <NoteCreationFeedbackRuntime />
      <FolderCustomizerBridgeRuntime />
      <OrganicWorkspaceRuntime />
      <WorkspacePersonalizationRuntime />
      <PrivacyStatusHelp />
      <FolderAppearanceRuntime />
      <FolderOperationFeedbackRuntime />
      <FolderCreationRuntime />
      <FolderMobileDragRuntime />
      <TagCreationRuntime />
      <TagMobileGestureRuntime />
      <V383WorkspaceVisualRuntime />
    </>
  )
}
