import type { ComponentType } from 'react'
import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'

export interface EditorSurfaceDefinition {
  id: string
  label: string
  experimental?: boolean
  load: () => Promise<{ default: ComponentType<EditorSurfaceProps> }>
  capabilities: EditorSurfaceCapabilities
}

/**
 * Stable surface catalog.
 *
 * Keeping every concrete implementation here lets Home select an editor without
 * importing a sheet. The experimental replica can therefore be removed by deleting
 * one catalog entry and its implementation files; persistence, encryption, Home and
 * navigation remain unchanged.
 */
export const editorSurfaceDefinitions = {
  'qwen-sanitized-v1': {
    id: 'qwen-sanitized-v1',
    label: 'Editor actual',
    load: async () => {
      const { QwenSheetSurface } = await import(
        './implementations/QwenSheetSurface'
      )
      return { default: QwenSheetSurface }
    },
    capabilities: {
      plainText: true,
      richBlocks: true,
      attachments: false,
    },
  },
  'replica-v16': {
    id: 'replica-v16',
    label: 'Hoja réplica V16',
    experimental: true,
    load: async () => {
      const { ReplicaV16SheetSurface } = await import(
        './implementations/ReplicaV16SheetSurface'
      )
      return { default: ReplicaV16SheetSurface }
    },
    capabilities: {
      plainText: true,
      richBlocks: true,
      attachments: true,
    },
  },
} satisfies Record<string, EditorSurfaceDefinition>

export type EditorSurfaceId = keyof typeof editorSurfaceDefinitions
export const DEFAULT_EDITOR_SURFACE_ID: EditorSurfaceId = 'qwen-sanitized-v1'

export function resolveEditorSurface(id?: string): EditorSurfaceDefinition {
  if (id && id in editorSurfaceDefinitions) {
    return editorSurfaceDefinitions[id as EditorSurfaceId]
  }
  return editorSurfaceDefinitions[DEFAULT_EDITOR_SURFACE_ID]
}

/** Default composition remains unchanged unless Home explicitly selects another surface. */
export const activeEditorSurface: EditorSurfaceDefinition =
  editorSurfaceDefinitions[DEFAULT_EDITOR_SURFACE_ID]
