import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import type {
  EditorSurfaceCapabilities,
  EditorSurfaceProps,
} from './editorSurfaceContract'
import {
  activeEditorSurface,
  resolveEditorSurface,
  type EditorSurfaceId,
} from './editorSurfaceRegistry'

const ActiveSurface = lazy(activeEditorSurface.load)
const lazySurfaceCache = new Map<string, LazyExoticComponent<ComponentType<EditorSurfaceProps>>>()

function lazySurfaceFor(surfaceId?: EditorSurfaceId) {
  if (!surfaceId || surfaceId === activeEditorSurface.id) return ActiveSurface

  const definition = resolveEditorSurface(surfaceId)
  const cached = lazySurfaceCache.get(definition.id)
  if (cached) return cached

  const loaded = lazy(definition.load)
  lazySurfaceCache.set(definition.id, loaded)
  return loaded
}

export interface EditorSurfaceHostProps extends EditorSurfaceProps {
  /** Optional presentation-only selection. Note data is independent from this value. */
  surfaceId?: EditorSurfaceId
}

/**
 * Stable host for a note editor surface.
 *
 * Home imports this host instead of a concrete sheet/template. Concrete surfaces are
 * registered in editorSurfaceRegistry and loaded only when mounted. Selecting the
 * experimental replica changes presentation only; storage, crypto, navigation and
 * note identity continue through the same EditorSurfaceProps contract.
 */
export function EditorSurface({ surfaceId, ...props }: EditorSurfaceHostProps) {
  const selectedSurface = resolveEditorSurface(surfaceId)
  const SelectedSurface = lazySurfaceFor(surfaceId)
  const surfaceProps = selectedSurface.capabilities.richBlocks
    ? props
    : {
        ...props,
        loadBlocks: undefined,
        onRequestBlockSave: undefined,
      }

  return (
    <Suspense fallback={null}>
      <SelectedSurface {...surfaceProps} />
    </Suspense>
  )
}

/** Capabilities of the default surface retained for compatibility and diagnostics. */
export const editorSurfaceCapabilities: EditorSurfaceCapabilities =
  activeEditorSurface.capabilities
