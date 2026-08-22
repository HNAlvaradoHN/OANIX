import { registerPlugin } from '@capacitor/core'
import { isAndroidNativeAccountAuth } from '../../platform/android/nativeAccountAuth.ts'
import { GOOGLE_DRIVE_APPDATA_SCOPE } from './googleDriveStorageProvider.ts'
import {
  clearGoogleDriveAccessTokenLease,
  setGoogleDriveAccessTokenLease,
} from './googleDriveAccessTokenLease.ts'

interface NativeDriveAuthorizationResult {
  cancelled: boolean
  interactionRequired?: boolean
  accessToken?: string
  expiresInSeconds?: number
  scope?: string
}

interface OanixDriveAuthPlugin {
  authorize(): Promise<NativeDriveAuthorizationResult>
  refresh(): Promise<NativeDriveAuthorizationResult>
}

const OanixDriveAuth = registerPlugin<OanixDriveAuthPlugin>('OanixDriveAuth')

function acceptAuthorizationResult(result: NativeDriveAuthorizationResult): boolean {
  if (result.cancelled) return false

  const token = result.accessToken?.trim()
  const expiresInSeconds = Number(result.expiresInSeconds)
  if (!token || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 90) {
    throw new Error('Android no devolvió una credencial temporal válida para Google Drive.')
  }
  if (result.scope !== GOOGLE_DRIVE_APPDATA_SCOPE) {
    throw new Error('Android no confirmó el permiso privado de almacenamiento de OANIX.')
  }

  setGoogleDriveAccessTokenLease(
    token,
    Date.now() + Math.floor(expiresInSeconds * 1000),
  )
  return true
}

export async function authorizeGoogleDriveOnAndroid(): Promise<boolean> {
  clearGoogleDriveAccessTokenLease()
  if (!isAndroidNativeAccountAuth()) {
    throw new Error('La autorización nativa de Google Drive solo está disponible en Android.')
  }

  return acceptAuthorizationResult(await OanixDriveAuth.authorize())
}

export async function refreshGoogleDriveOnAndroidSilently(): Promise<boolean> {
  if (!isAndroidNativeAccountAuth()) return false
  try {
    return acceptAuthorizationResult(await OanixDriveAuth.refresh())
  } catch {
    clearGoogleDriveAccessTokenLease()
    return false
  }
}
