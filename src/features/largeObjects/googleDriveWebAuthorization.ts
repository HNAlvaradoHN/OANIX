import { isAndroidNativeAccountAuth } from '../../platform/android/nativeAccountAuth.ts'
import { GOOGLE_DRIVE_APPDATA_SCOPE } from './googleDriveStorageProvider.ts'
import {
  clearGoogleDriveAccessTokenLease,
  setGoogleDriveAccessTokenLease,
} from './googleDriveAccessTokenLease.ts'

const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const GOOGLE_IDENTITY_SCRIPT_ID = 'oanix-google-identity-services'

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

interface GoogleTokenClient {
  requestAccessToken(config?: { prompt?: string }): void
}

interface GoogleOauth2Api {
  initTokenClient(config: {
    client_id: string
    scope: string
    include_granted_scopes: boolean
    callback(response: GoogleTokenResponse): void
    error_callback?(error: { type?: string; message?: string }): void
  }): GoogleTokenClient
}

interface GoogleIdentityWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: GoogleOauth2Api
    }
  }
}

let scriptPromise: Promise<void> | null = null

function driveWebClientId(): string | null {
  const raw = import.meta.env?.VITE_GOOGLE_DRIVE_WEB_CLIENT_ID
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  return value || null
}

export function isGoogleDriveWebAuthorizationConfigured(): boolean {
  return !isAndroidNativeAccountAuth() && Boolean(driveWebClientId())
}

function requireBrowser(): GoogleIdentityWindow {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('La autorización web de Google Drive solo está disponible en el navegador.')
  }
  if (isAndroidNativeAccountAuth()) {
    throw new Error('Android usa una autorización nativa separada para Google Drive.')
  }
  return window as GoogleIdentityWindow
}

async function loadGoogleIdentityServices(): Promise<GoogleIdentityWindow> {
  const browser = requireBrowser()
  if (browser.google?.accounts?.oauth2) return browser
  if (scriptPromise) {
    await scriptPromise
    if (!browser.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services no quedó disponible después de cargar su biblioteca.')
    }
    return browser
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity Services.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_IDENTITY_SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SCRIPT_URL
    script.async = true
    script.defer = true
    script.referrerPolicy = 'strict-origin-when-cross-origin'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity Services.')), { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    scriptPromise = null
    throw error
  })

  await scriptPromise
  if (!browser.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services no expuso el módulo OAuth esperado.')
  }
  return browser
}

function scopeWasGranted(rawScope: string | undefined): boolean {
  if (!rawScope) return false
  return rawScope.split(/\s+/u).includes(GOOGLE_DRIVE_APPDATA_SCOPE)
}

async function requestGoogleDriveAccessToken(prompt: string): Promise<void> {
  clearGoogleDriveAccessTokenLease()
  const clientId = driveWebClientId()
  if (!clientId) {
    throw new Error('Google Drive todavía no está configurado para la versión web de OANIX.')
  }

  const browser = await loadGoogleIdentityServices()
  const oauth2 = browser.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google Identity Services no está disponible.')

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finishError = (message: string) => {
      if (settled) return
      settled = true
      clearGoogleDriveAccessTokenLease()
      reject(new Error(message))
    }

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_APPDATA_SCOPE,
      include_granted_scopes: true,
      callback: (response) => {
        if (settled) return
        if (response.error) {
          finishError(response.error_description || 'Google no autorizó el acceso privado de OANIX a Drive.')
          return
        }
        const token = response.access_token?.trim()
        const expiresInSeconds = Number(response.expires_in)
        if (!token || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 90) {
          finishError('Google Drive devolvió una credencial temporal incompleta.')
          return
        }
        if (!scopeWasGranted(response.scope)) {
          finishError('Google no concedió el permiso privado de almacenamiento solicitado por OANIX.')
          return
        }

        setGoogleDriveAccessTokenLease(token, Date.now() + Math.floor(expiresInSeconds * 1000))
        settled = true
        resolve()
      },
      error_callback: (error) => {
        const detail = typeof error?.message === 'string' && error.message.trim()
          ? ` ${error.message.trim()}`
          : ''
        finishError(`No se pudo completar la autorización de Google Drive.${detail}`)
      },
    })

    client.requestAccessToken({ prompt })
  })
}

export async function authorizeGoogleDriveOnWeb(): Promise<void> {
  await requestGoogleDriveAccessToken('select_account')
}

export async function refreshGoogleDriveOnWebSilently(): Promise<boolean> {
  if (!isGoogleDriveWebAuthorizationConfigured()) return false
  try {
    await requestGoogleDriveAccessToken('')
    return true
  } catch {
    clearGoogleDriveAccessTokenLease()
    return false
  }
}
