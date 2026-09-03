export interface OanixClipboardLike {
  files?: ArrayLike<File> | null
  items?: ArrayLike<Pick<DataTransferItem, 'kind' | 'type' | 'getAsFile'>> | null
}

function isImageFile(file: File | null): file is File {
  return Boolean(file && file.type.toLocaleLowerCase().startsWith('image/'))
}

/**
 * Extracts one image from the browser's native paste payload without requesting
 * programmatic clipboard permission. Brave/Android and PWA paste therefore use the
 * same File boundary as the picker and can share the real OANIX insertion command.
 */
export function findOanixClipboardImage(clipboard: OanixClipboardLike | null | undefined): File | null {
  if (!clipboard) return null

  const items = clipboard.items
  if (items) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      if (!item || item.kind !== 'file' || !item.type.toLocaleLowerCase().startsWith('image/')) continue
      const file = item.getAsFile()
      if (isImageFile(file)) return file
    }
  }

  const files = clipboard.files
  if (files) {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      if (isImageFile(file)) return file
    }
  }

  return null
}
