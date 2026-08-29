import { InfographicWorkspace } from './themes/infographic/InfographicWorkspace'
import type { WorkspaceThemeProps } from './workspaceThemeContract'

export type WorkspaceV2SidebarProps = WorkspaceThemeProps

export function WorkspaceV2Sidebar(props: WorkspaceV2SidebarProps) {
  return <InfographicWorkspace {...props} />
}
