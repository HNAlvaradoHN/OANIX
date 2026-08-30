/**
 * Persistence bridge used by swappable note-sheet themes when a user has
 * explicitly confirmed removal of an atomic editor element.
 *
 * ImageNoteEditor consumes the authorization marker before reconciling
 * protected blocks, so confirmed removals participate in the normal OANIX
 * history/onChange/encrypted persistence pipeline instead of being restored as
 * accidental DOM loss.
 */
export function persistConfirmedAtomicElementRemoval(block: HTMLElement): boolean {
  const editor = block.closest<HTMLElement>('.editor-surface')
  if (!editor || block.parentElement !== editor) return false

  const blockId = block.dataset.blockId
  if (blockId) editor.dataset.oanixAuthorizedProtectedRemoval = blockId

  block.remove()
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}
