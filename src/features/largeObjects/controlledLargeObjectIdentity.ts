const SAMPLE_BYTES = 64 * 1024

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createControlledLargeObjectId(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto no está disponible para identificar la transferencia grande.')
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new Error('El archivo seleccionado no tiene un tamaño válido.')
  }

  const headLength = Math.min(SAMPLE_BYTES, file.size)
  const tailStart = Math.max(0, file.size - SAMPLE_BYTES)
  const metadata = new TextEncoder().encode(JSON.stringify([
    'OANIX',
    'controlled-large-object-id',
    1,
    file.size,
    Number.isSafeInteger(file.lastModified) ? file.lastModified : 0,
  ]))
  const head = new Uint8Array(await file.slice(0, headLength).arrayBuffer())
  const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer())
  const fingerprintInput = new Uint8Array(metadata.byteLength + head.byteLength + tail.byteLength)

  try {
    fingerprintInput.set(metadata, 0)
    fingerprintInput.set(head, metadata.byteLength)
    fingerprintInput.set(tail, metadata.byteLength + head.byteLength)
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', fingerprintInput))
    try {
      return `field-${toHex(digest)}`
    } finally {
      digest.fill(0)
    }
  } finally {
    metadata.fill(0)
    head.fill(0)
    tail.fill(0)
    fingerprintInput.fill(0)
  }
}
