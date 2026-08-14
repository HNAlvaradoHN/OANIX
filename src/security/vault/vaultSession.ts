let activeVaultKey: CryptoKey | null = null

export function setActiveVaultKey(vaultKey: CryptoKey): void {
  activeVaultKey = vaultKey
}

export function clearActiveVaultKey(): void {
  activeVaultKey = null
}

export function isVaultUnlocked(): boolean {
  return activeVaultKey !== null
}

export function requireActiveVaultKey(): CryptoKey {
  if (!activeVaultKey) {
    throw new Error('The OANIX vault is locked.')
  }

  return activeVaultKey
}
