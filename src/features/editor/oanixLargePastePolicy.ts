export const OANIX_INLINE_PASTE_MAX_UTF16 = 128_000
export const OANIX_INLINE_PASTE_MAX_UTF8_BYTES = 256_000
export const OANIX_INLINE_PASTE_MAX_LINES = 1_200

export type OanixPasteDisposition =
  | {
      mode: 'inline'
      utf16Length: number
      utf8Bytes: number
      lines: number
    }
  | {
      mode: 'large-text-element'
      reason: 'utf16-size' | 'utf8-size' | 'line-count'
      utf16Length: number
      utf8Bytes?: number
      lines?: number
    }

interface OanixLargePastePolicyOptions {
  maxUtf16Length?: number
  maxUtf8Bytes?: number
  maxLines?: number
}

/**
 * Classifies clipboard text without allocating a second UTF-8 buffer.
 *
 * The cheap UTF-16 length guard intentionally runs first: truly huge clipboard
 * strings are routed to the optimized long-text element in O(1), instead of
 * synchronously scanning millions of characters on the paste event. Only text
 * still eligible for inline insertion is scanned, and that scan exits as soon as
 * either the line or UTF-8 byte threshold is crossed.
 */
export function classifyOanixTextPaste(
  text: string,
  {
    maxUtf16Length = OANIX_INLINE_PASTE_MAX_UTF16,
    maxUtf8Bytes = OANIX_INLINE_PASTE_MAX_UTF8_BYTES,
    maxLines = OANIX_INLINE_PASTE_MAX_LINES,
  }: OanixLargePastePolicyOptions = {},
): OanixPasteDisposition {
  const utf16Length = text.length
  if (utf16Length > maxUtf16Length) {
    return { mode: 'large-text-element', reason: 'utf16-size', utf16Length }
  }

  let utf8Bytes = 0
  let lines = 1

  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index)

    if (codeUnit === 10) {
      lines += 1
      if (lines > maxLines) {
        return { mode: 'large-text-element', reason: 'line-count', utf16Length, utf8Bytes, lines }
      }
    }

    if (codeUnit <= 0x7f) {
      utf8Bytes += 1
    } else if (codeUnit <= 0x7ff) {
      utf8Bytes += 2
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        utf8Bytes += 4
        index += 1
      } else {
        utf8Bytes += 3
      }
    } else {
      utf8Bytes += 3
    }

    if (utf8Bytes > maxUtf8Bytes) {
      return { mode: 'large-text-element', reason: 'utf8-size', utf16Length, utf8Bytes, lines }
    }
  }

  return { mode: 'inline', utf16Length, utf8Bytes, lines }
}
