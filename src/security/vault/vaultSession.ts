let activeVaultKey: CryptoKey | null = null
const vaultSessionCleanupCallbacks = new Set<() => void>()

export function setActiveVaultKey(vaultKey: CryptoKey): void {
  activeVaultKey = vaultKey
}

export function registerVaultSessionCleanup(cleanup: () => void): () => void {
  vaultSessionCleanupCallbacks.add(cleanup)
  return () => vaultSessionCleanupCallbacks.delete(cleanup)
}

export function clearActiveVaultKey(): void {
  activeVaultKey = null
  for (const cleanup of vaultSessionCleanupCallbacks) {
    try {
      cleanup()
    } catch {
      // Locking the vault remains authoritative even if optional session cleanup fails.
    }
  }
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
