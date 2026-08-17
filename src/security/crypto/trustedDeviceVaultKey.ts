const VAULT_KEY_LENGTH = 32

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export async function importTrustedDeviceVaultKey(encodedVaultKey: string): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is not available in this runtime.')
  }

  const vaultKeyBytes = decodeBase64(encodedVaultKey)
  if (vaultKeyBytes.byteLength !== VAULT_KEY_LENGTH) {
    vaultKeyBytes.fill(0)
    throw new Error('Invalid trusted-device vault key length.')
  }

  const copy = Uint8Array.from(vaultKeyBytes)
  vaultKeyBytes.fill(0)

  try {
    return await globalThis.crypto.subtle.importKey(
      'raw',
      copy.buffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    )
  } finally {
    copy.fill(0)
  }
}
