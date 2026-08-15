import { MOBILE_LAYOUT_MAX_WIDTH } from '../../shared/responsiveLayout'

export const MOBILE_IMAGE_BREAKPOINT = MOBILE_LAYOUT_MAX_WIDTH

const DESKTOP_MIN_IMAGE_WIDTH_PERCENT = 35
const DESKTOP_MIN_IMAGE_WIDTH_PIXELS = 220
const MOBILE_MIN_IMAGE_WIDTH_PERCENT = 22
const MOBILE_MIN_IMAGE_WIDTH_PIXELS = 88
const DESKTOP_MAX_IMAGE_WIDTH_PERCENT = 100
const MOBILE_MAX_IMAGE_WIDTH_PERCENT = 96
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
  const maximum = mobile
    ? MOBILE_MAX_IMAGE_WIDTH_PERCENT
    : DESKTOP_MAX_IMAGE_WIDTH_PERCENT

  const pixelMinimum = editorWidth > 0 ? (minimumPixels / editorWidth) * 100 : maximum
  const minimum = Math.min(maximum, Math.max(minimumPercent, Math.ceil(pixelMinimum)))

  return Math.min(maximum, Math.max(minimum, Math.round(widthPercent)))
}

interface ResizeImageWidthInput {
  editorWidth: number
  startWidthPercent: number
  previewWidth: number
  previewHeight: number
  deltaX: number
  deltaY: number
  direction: string
  mobile: boolean
}

export function resizeImageWidthPercent({
  editorWidth,
  startWidthPercent,
  previewWidth,
  previewHeight,
  deltaX,
  deltaY,
  direction,
  mobile,
}: ResizeImageWidthInput): number {
  const horizontalMultiplier = direction.includes('w') ? -1 : 1
  const verticalMultiplier = direction.includes('n') ? -1 : 1
  const horizontalDelta = deltaX * horizontalMultiplier
  const aspectWidthPerHeight = previewWidth > 0 && previewHeight > 0
    ? previewWidth / previewHeight
    : 1
  const verticalDelta = deltaY * verticalMultiplier * aspectWidthPerHeight
  const deltaPixels = Math.abs(verticalDelta) > Math.abs(horizontalDelta)
    ? verticalDelta
    : horizontalDelta
  const deltaPercent = editorWidth > 0 ? (deltaPixels / editorWidth) * 100 : 0

  return clampImageWidthPercent(
    editorWidth,
    startWidthPercent + deltaPercent,
    mobile,
  )
}
