export interface ViewportMetricsInput {
  layoutHeight: number
  visualHeight: number
  visualOffsetTop: number
}

/**
 * Returns the portion of the layout viewport currently obscured below the
 * visual viewport (typically the on-screen keyboard). Browsers that resize
 * the layout viewport naturally return zero, so the same rule works across
 * desktop, tablets and different mobile keyboard behaviours.
 */
export function keyboardInsetFromViewport({
  layoutHeight,
  visualHeight,
  visualOffsetTop,
}: ViewportMetricsInput): number {
  if (![layoutHeight, visualHeight, visualOffsetTop].every(Number.isFinite)) return 0
  return Math.max(0, Math.round(layoutHeight - visualHeight - visualOffsetTop))
}
