import { lazy, Suspense } from 'react'
import { CodeBlockExportRuntime } from '../features/editor/CodeBlockExportRuntime'
import { EditorOperationRuntime } from '../features/editor/EditorOperationRuntime'
import { LargePasteRuntime } from '../features/editor/LargePasteRuntime'
import { AuroraDestructiveActionConfirmationRuntime } from '../features/notes/AuroraDestructiveActionConfirmationRuntime'
import { NoteCreationFeedbackRuntime } from '../features/notes/NoteCreationFeedbackRuntime'
import { PrivacyStatusHelp } from '../features/privacy/PrivacyStatusHelp'
import { WORKSPACE_V2_ENABLED } from './workspaceExperience'

const LegacyWorkspaceRuntimeGate = lazy(() =>
  import('./LegacyWorkspaceRuntimeGate').then((module) => ({
    default: module.LegacyWorkspaceRuntimeGate,
  })),
)

interface WorkspaceRuntimeGateProps {
  workspaceRevision: number
}

export function WorkspaceRuntimeGate({
  workspaceRevision,
}: WorkspaceRuntimeGateProps) {
  return (
    <>
      <EditorOperationRuntime />
      <LargePasteRuntime />
      <CodeBlockExportRuntime />
      <AuroraDestructiveActionConfirmationRuntime />
      <NoteCreationFeedbackRuntime />
      <PrivacyStatusHelp />
      {!WORKSPACE_V2_ENABLED && (
        <Suspense fallback={null}>
          <LegacyWorkspaceRuntimeGate workspaceRevision={workspaceRevision} />
        </Suspense>
      )}
    </>
  )
}
