import type { ComponentType } from 'react'
import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'
import {
  PlainTextEditorSurface,
  plainTextEditorSurfaceCapabilities,
} from './implementations/PlainTextEditorSurface'

export interface EditorSurfaceDefinition {
  id: string
  component: ComponentType<EditorSurfaceProps>
  capabilities: EditorSurfaceCapabilities
}

/**
 * Active editor-surface composition.
 *
 * This is the only module that selects a concrete visual editor implementation.
 * Future sheet replacements should register/select their implementation here so
 * Home, persistence, encryption, sync and navigation remain untouched.
 */
export const activeEditorSurface: EditorSurfaceDefinition = {
  id: 'plain-text-transition',
  component: PlainTextEditorSurface,
  capabilities: plainTextEditorSurfaceCapabilities,
}
