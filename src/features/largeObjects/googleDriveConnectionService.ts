import { isAndroidNativeAccountAuth } from '../../platform/android/nativeAccountAuth.ts'
import type { LargeObjectStorageCapacity } from './largeObjectTransferContract.ts'
import { authorizeGoogleDriveOnAndroid } from './googleDriveAndroidAuthorization.ts'
import {
  authorizeGoogleDriveOnWeb,
  isGoogleDriveWebAuthorizationConfigured,
} from './googleDriveWebAuthorization.ts'
import {
  clearGoogleDriveAccessTokenLease,
  createGoogleDriveStorageProviderFromActiveLease,
  hasUsableGoogleDriveAccessTokenLease,
} from './googleDriveAccessTokenLease.ts'

export type GoogleDriveConnectionAvailability =
  | 'android-ready'
  | 'web-ready'
  | 'web-unconfigured'

export interface GoogleDriveConnectionSnapshot {
  connected: boolean
  availability: GoogleDriveConnectionAvailability
  capacity: LargeObjectStorageCapacity | null
}

export function getGoogleDriveConnectionAvailability(): GoogleDriveConnectionAvailability {
  if (isAndroidNativeAccountAuth()) return 'android-ready'
  return isGoogleDriveWebAuthorizationConfigured() ? 'web-ready' : 'web-unconfigured'
}

export function hasActiveGoogleDriveConnection(): boolean {
  return hasUsableGoogleDriveAccessTokenLease()
}

export function disconnectGoogleDriveSession(): void {
  // This intentionally clears only OANIX's short-lived in-memory credential.
  // Revoking Google's grant is a different, explicit user action and is not implied here.
  clearGoogleDriveAccessTokenLease()
}

export async function inspectActiveGoogleDriveConnection(): Promise<LargeObjectStorageCapacity> {
  if (!hasUsableGoogleDriveAccessTokenLease()) {
    throw new Error('Google Drive necesita autorización antes de consultar el almacenamiento.')
  }
  const provider = createGoogleDriveStorageProviderFromActiveLease()
  const capacity = await provider.getStorageCapacity()
  return capacity
}

export async function connectGoogleDriveAndInspect(): Promise<GoogleDriveConnectionSnapshot> {
  const availability = getGoogleDriveConnectionAvailability()
  if (availability === 'web-unconfigured') {
    throw new Error('Google Drive todavía no está configurado para esta instalación web de OANIX.')
  }

  try {
    if (availability === 'android-ready') {
      const granted = await authorizeGoogleDriveOnAndroid()
      if (!granted) {
        return { connected: false, availability, capacity: null }
      }
    } else {
      await authorizeGoogleDriveOnWeb()
    }

    const capacity = await inspectActiveGoogleDriveConnection()
    return { connected: true, availability, capacity }
  } catch (error) {
    clearGoogleDriveAccessTokenLease()
    throw error
  }
}
