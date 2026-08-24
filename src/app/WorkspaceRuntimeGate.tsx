import { useEffect, useState } from 'react'
import { EditorOperationRuntime } from '../features/editor/EditorOperationRuntime'
import { FolderAppearanceRuntime } from '../features/folders/FolderAppearanceRuntime'
import { FolderCreationRuntime } from '../features/folders/FolderCreationRuntime'
import { FolderCustomizerBridgeRuntime } from '../features/folders/FolderCustomizerBridgeRuntime'
import { FolderMobileDragRuntime } from '../features/folders/FolderMobileDragRuntime'
import { FolderOperationFeedbackRuntime } from '../features/folders/FolderOperationFeedbackRuntime'
import { FolderTiltRuntime } from '../features/folders/FolderTiltRuntime'
import { FolderDockFinishingRuntime } from '../features/notes/FolderDockFinishingRuntime'
import { OrganicWorkspaceRuntime } from '../features/notes/OrganicWorkspaceRuntime'
import { V383WorkspaceVisualRuntime } from '../features/notes/V383WorkspaceVisualRuntime'
import { WorkspacePersonalizationRuntime } from '../features/notes/WorkspacePersonalizationRuntime'
import { PrivacyStatusHelp } from '../features/privacy/PrivacyStatusHelp'
import { TagCreationRuntime } from '../features/tags/TagCreationRuntime'

function workspaceExists() {
  return document.querySelector('.notes-sidebar') !== null
}

export function WorkspaceRuntimeGate() {
  const [active, setActive] = useState(workspaceExists)

  useEffect(() => {
    const sync = () => setActive(workspaceExists())
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!active) return null

  return (
    <>
      <EditorOperationRuntime />
      <FolderCustomizerBridgeRuntime />
      <OrganicWorkspaceRuntime />
      <FolderDockFinishingRuntime />
      <WorkspacePersonalizationRuntime />
      <PrivacyStatusHelp />
      <FolderAppearanceRuntime />
      <FolderOperationFeedbackRuntime />
      <FolderCreationRuntime />
      <FolderMobileDragRuntime />
      <FolderTiltRuntime />
      <TagCreationRuntime />
      <V383WorkspaceVisualRuntime />
    </>
  )
}
