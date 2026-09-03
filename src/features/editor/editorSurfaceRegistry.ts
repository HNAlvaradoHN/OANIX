import type { ComponentType } from 'react'
import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'

export interface EditorSurfaceDefinition {
  id: string
  load: () => Promise<{ default: ComponentType<EditorSurfaceProps> }>
  capabilities: EditorSurfaceCapabilities
}

/**
 * Active editor-surface composition.
 *
 * This is the only module that selects a concrete visual editor implementation.
 * The implementation is loaded only when the editor host is actually mounted,
 * so Home does not pay the runtime/bundle cost of a sheet that is not in use.
 * Future replacements should change only this composition point while Home,
 * persistence, encryption, sync and navigation remain untouched.
 */
export const activeEditorSurface: EditorSurfaceDefinition = {
  id: 'oanix-notes-sheet-v1',
  load: async () => {
    const { OanixNotesSheetMobileGuard } = await import(
      './implementations/OanixNotesSheetMobileGuard'
    )
    return { default: OanixNotesSheetMobileGuard }
  },
  capabilities: {
    plainText: true,
    richBlocks: false,
    attachments: false,
  },
}
