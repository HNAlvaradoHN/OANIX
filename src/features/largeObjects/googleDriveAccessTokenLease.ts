import { GoogleDriveStorageProvider } from './googleDriveStorageProvider.ts'

const EXPIRY_SAFETY_WINDOW_MS = 60_000
const DRIVE_RESUMABLE_UPLOAD_ORIGIN = 'https://www.googleapis.com'
const DRIVE_RESUMABLE_UPLOAD_PATH = '/upload/drive/v3/files'

interface GoogleDriveTokenLease {
  accessToken: string
  expiresAtMs: number
}

let activeLease: GoogleDriveTokenLease | null = null

function validateAccessToken(accessToken: string): string {
  const normalized = accessToken.trim()
  if (!normalized || /\s/.test(normalized) || normalized.length > 8192) {
    throw new Error('Google Drive devolvió un token de acceso no válido.')
  }
  return normalized
}

function validateExpiry(expiresAtMs: number): number {
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error('Google Drive devolvió una vigencia de acceso no válida.')
  }
  return expiresAtMs
}

function isGoogleDriveResumableSessionPut(input: RequestInfo | URL, init?: RequestInit): boolean {
  if ((init?.method ?? 'GET').toUpperCase() !== 'PUT') return false

  let url: URL
  try {
    url = new URL(String(input))
  } catch {
    return false
  }

  return (
    url.origin === DRIVE_RESUMABLE_UPLOAD_ORIGIN &&
    url.pathname === DRIVE_RESUMABLE_UPLOAD_PATH &&
    url.searchParams.has('upload_id')
  )
}

function driveNetworkStage(input: RequestInfo | URL, init?: RequestInit): string {
  const method = (init?.method ?? 'GET').toUpperCase()
  let url: URL | null = null
  try {
    url = new URL(String(input))
  } catch {
    // Keep a generic label when the URL cannot be parsed.
  }

  if (
    method === 'POST' &&
    url?.origin === DRIVE_RESUMABLE_UPLOAD_ORIGIN &&
    url.pathname === DRIVE_RESUMABLE_UPLOAD_PATH &&
    url.searchParams.get('uploadType') === 'resumable'
  ) {
    return 'Google Drive no pudo crear la sesión reanudable'
  }

  if (isGoogleDriveResumableSessionPut(input, init)) {
    const contentRange = new Headers(init?.headers).get('Content-Range') ?? ''
    return contentRange.startsWith('bytes */')
      ? 'Google Drive no pudo consultar o finalizar la sesión reanudable'
      : 'Google Drive no pudo subir el fragmento cifrado'
  }

  return 'Google Drive tuvo un fallo de red'
}

async function executeDriveBrowserFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await globalThis.fetch(input, init)
  } catch (error) {
    const detail = error instanceof Error && error.message ? `: ${error.message}` : ''
    throw new Error(`${driveNetworkStage(input, init)}${detail}`)
  }
}

export async function googleDriveBrowserFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!isGoogleDriveResumableSessionPut(input, init)) {
    return executeDriveBrowserFetch(input, init)
  }

  const headers = new Headers(init?.headers)
  headers.delete('Authorization')
  return executeDriveBrowserFetch(input, { ...init, headers })
}

export function setGoogleDriveAccessTokenLease(
  accessToken: string,
  expiresAtMs: number,
): void {
  activeLease = {
    accessToken: validateAccessToken(accessToken),
    expiresAtMs: validateExpiry(expiresAtMs),
  }
}

export function clearGoogleDriveAccessTokenLease(): void {
  activeLease = null
}

export function hasUsableGoogleDriveAccessTokenLease(nowMs = Date.now()): boolean {
  return Boolean(
    activeLease &&
    Number.isSafeInteger(nowMs) &&
    nowMs >= 0 &&
    activeLease.expiresAtMs - nowMs > EXPIRY_SAFETY_WINDOW_MS,
  )
}

export async function requireGoogleDriveAccessTokenLease(): Promise<string> {
  if (!hasUsableGoogleDriveAccessTokenLease()) {
    clearGoogleDriveAccessTokenLease()
    throw new Error('Google Drive necesita autorización antes de continuar.')
  }
  return activeLease!.accessToken
}

export function createGoogleDriveStorageProviderFromActiveLease(): GoogleDriveStorageProvider {
  return new GoogleDriveStorageProvider(
    requireGoogleDriveAccessTokenLease,
    googleDriveBrowserFetch,
  )
}
