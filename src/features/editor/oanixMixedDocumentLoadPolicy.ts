import type { EditorSurfaceBlock } from './editorSurfaceContract.ts'
import { projectOanixMixedDocument } from './oanixMixedDocumentProjection.ts'

export type OanixMixedDocumentLoadDecision =
  | { mode: 'plain'; reason: 'no-blocks' }
  | { mode: 'mixed'; reason: 'supported-blocks' }
  | { mode: 'recoverable-conflict'; reason: 'plain-and-blocks' }
  | { mode: 'unsupported-blocks'; reason: 'unknown-block-kind'; unsupportedKinds: string[] }

/**
 * Decides whether the approved sheet may switch from its continuous plain textarea
 * to the mixed renderer after loading metadata.
 *
 * We never auto-migrate on open. Mixed mode is entered only when persisted blocks
 * are already authoritative and the legacy/plain body is empty. If both sources
 * contain content, preserving both wins over guessing which one is newer.
 */
export function decideOanixMixedDocumentLoad(
  plainText: string,
  blocks: readonly EditorSurfaceBlock[],
): OanixMixedDocumentLoadDecision {
  if (blocks.length === 0) return { mode: 'plain', reason: 'no-blocks' }

  if (plainText.length > 0) {
    return { mode: 'recoverable-conflict', reason: 'plain-and-blocks' }
  }

  const projected = projectOanixMixedDocument(blocks)
  const unsupportedKinds = [...new Set(
    projected
      .filter((node) => node.type === 'unsupported')
      .map((node) => node.block.kind),
  )]

  if (unsupportedKinds.length > 0) {
    return { mode: 'unsupported-blocks', reason: 'unknown-block-kind', unsupportedKinds }
  }

  return { mode: 'mixed', reason: 'supported-blocks' }
}
