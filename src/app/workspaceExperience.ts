// Single authority switch for the workspace migration.
//
// V2 is now the active list/dashboard surface. App and WorkspaceRuntimeGate use
// this same flag to keep every legacy visual/drag authority unmounted rather
// than letting old and new interactions run in parallel.
export const WORKSPACE_V2_ENABLED = true
