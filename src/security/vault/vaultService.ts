import {
  readVaultMetadata,
  writeVaultMetadata,
  type VaultMetadata,
} from '../../storage/repositories/vaultRepository'

export type VaultInitializationResult =
  | { status: 'ready'; created: boolean }
  | { status: 'error'; message: string }

export async function initializeLocalVault(): Promise<VaultInitializationResult> {
  try {
    const existingMetadata = await readVaultMetadata()

    if (existingMetadata) {
      return { status: 'ready', created: false }
    }

    const metadata: VaultMetadata = {
      key: 'primary',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      protection: 'pending',
    }

    await writeVaultMetadata(metadata)
    return { status: 'ready', created: true }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown local vault error.',
    }
  }
}
