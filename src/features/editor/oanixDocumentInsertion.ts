export interface OanixCursorInsertionPlan {
  cursorOffset: number
  beforeText: string
  afterText: string
}

/**
 * Creates a lossless split around the native textarea cursor.
 *
 * textarea.selectionStart is a UTF-16 code-unit offset, which matches String#slice.
 * Keeping the split in that coordinate system avoids approximate pixel/line anchors
 * and lets a future mixed document replace the cursor boundary with one atomic block
 * while preserving every character before and after it.
 *
 * This function intentionally does not mutate the current plain-text note. The
 * approved mobile sheet remains a single textarea until the rich-block transaction
 * can persist both text runs + the atomic element safely in one checkpoint.
 */
export function planOanixCursorInsertion(
  text: string,
  cursorOffset: number,
): OanixCursorInsertionPlan {
  const safeOffset = Number.isFinite(cursorOffset)
    ? Math.min(text.length, Math.max(0, Math.trunc(cursorOffset)))
    : text.length

  return {
    cursorOffset: safeOffset,
    beforeText: text.slice(0, safeOffset),
    afterText: text.slice(safeOffset),
  }
}
