export const LARGE_PASTE_LINE_THRESHOLD = 50
export const LARGE_PASTE_CHARACTER_THRESHOLD = 64 * 1024

export function clipboardLineCountAtMost(
  text: string,
  ceiling = LARGE_PASTE_LINE_THRESHOLD,
): number {
  if (!Number.isSafeInteger(ceiling) || ceiling <= 0) {
    throw new Error('El límite de líneas del pegado debe ser un entero positivo.')
  }
  if (!text) return 0

  let lines = 1
  for (let index = 0; index < text.length && lines < ceiling; index += 1) {
    const code = text.charCodeAt(index)
    if (code === 10) {
      lines += 1
      continue
    }
    if (code === 13 && text.charCodeAt(index + 1) !== 10) lines += 1
  }
  return lines
}

export function shouldEncapsulateClipboardPaste(text: string): boolean {
  if (!text) return false
  if (text.length >= LARGE_PASTE_CHARACTER_THRESHOLD) return true
  return clipboardLineCountAtMost(text) >= LARGE_PASTE_LINE_THRESHOLD
}
