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
 * Experimental surfaces remain isolated here so they can be removed without
 * changing persistence, encryption, Home or navigation.
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
  'continuous-sheet-v1': {
    id: 'continuous-sheet-v1',
    label: 'Hoja continua',
    experimental: true,
    load: async () => {
      const { ContinuousSheetSurface } = await import(
        './implementations/ContinuousSheetSurface'
      )
      return { default: ContinuousSheetSurface }
    },
    capabilities: {
      plainText: true,
      richBlocks: true,
      attachments: true,
    },
  },
} satisfies Record<string, EditorSurfaceDefinition>

export type EditorSurfaceId = keyof typeof editorSurfaceDefinitions

/** Branch-local review switch. `main` remains untouched. */
export const DEFAULT_EDITOR_SURFACE_ID: EditorSurfaceId = 'continuous-sheet-v1'

export function resolveEditorSurface(id?: string): EditorSurfaceDefinition {
  if (id && id in editorSurfaceDefinitions) {
    return editorSurfaceDefinitions[id as EditorSurfaceId]
  }
  return editorSurfaceDefinitions[DEFAULT_EDITOR_SURFACE_ID]
}

export const activeEditorSurface: EditorSurfaceDefinition =
  editorSurfaceDefinitions[DEFAULT_EDITOR_SURFACE_ID]
