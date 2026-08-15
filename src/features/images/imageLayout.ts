export const MOBILE_IMAGE_BREAKPOINT = 760

const DESKTOP_MIN_IMAGE_WIDTH_PERCENT = 35
const DESKTOP_MIN_IMAGE_WIDTH_PIXELS = 220
const MOBILE_MIN_IMAGE_WIDTH_PERCENT = 22
const MOBILE_MIN_IMAGE_WIDTH_PIXELS = 88
const DESKTOP_DEFAULT_IMAGE_WIDTH_PERCENT = 100
const MOBILE_DEFAULT_IMAGE_WIDTH_PERCENT = 88

export function isMobileImageViewport(viewportWidth: number): boolean {
  return Number.isFinite(viewportWidth) && viewportWidth <= MOBILE_IMAGE_BREAKPOINT
}

export function defaultImageWidthPercent(mobile: boolean): number {
  return mobile ? MOBILE_DEFAULT_IMAGE_WIDTH_PERCENT : DESKTOP_DEFAULT_IMAGE_WIDTH_PERCENT
}

export function clampImageWidthPercent(
  editorWidth: number,
  widthPercent: number,
  mobile: boolean,
): number {
  const minimumPercent = mobile
    ? MOBILE_MIN_IMAGE_WIDTH_PERCENT
    : DESKTOP_MIN_IMAGE_WIDTH_PERCENT
  const minimumPixels = mobile
    ? MOBILE_MIN_IMAGE_WIDTH_PIXELS
    : DESKTOP_MIN_IMAGE_WIDTH_PIXELS

  const pixelMinimum = editorWidth > 0 ? (minimumPixels / editorWidth) * 100 : 100
  const minimum = Math.min(100, Math.max(minimumPercent, Math.ceil(pixelMinimum)))

  return Math.min(100, Math.max(minimum, Math.round(widthPercent)))
}
