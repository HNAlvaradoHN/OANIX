export const MOBILE_LAYOUT_MAX_WIDTH = 760
export const TABLET_LAYOUT_MAX_WIDTH = 1100

export type ResponsiveLayout = 'mobile' | 'tablet' | 'desktop'

export function responsiveLayoutForWidth(width: number): ResponsiveLayout {
  if (!Number.isFinite(width) || width <= MOBILE_LAYOUT_MAX_WIDTH) return 'mobile'
  if (width <= TABLET_LAYOUT_MAX_WIDTH) return 'tablet'
  return 'desktop'
}

export function usesSinglePaneLayout(width: number): boolean {
  return responsiveLayoutForWidth(width) === 'mobile'
}
