import {
  validateUploadRangeRequest,
  type LargeObjectDownloadRangeRequest,
  type LargeObjectRemoteObject,
  type LargeObjectUploadRangeRequest,
  type LargeObjectUploadSession,
  type LargeObjectUploadStatus,
  type OanixStorageProvider,
} from './largeObjectTransferContract.ts'

export const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
export const GOOGLE_DRIVE_PROVIDER_ID = 'google-drive-appdata-v1'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_FILES_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const DRIVE_UPLOAD_HOST = 'www.googleapis.com'
const DRIVE_UPLOAD_PATH = '/upload/drive/v3/files'
const OPAQUE_FILE_PREFIX = 'oanix-object-'

export type GoogleDriveAccessTokenProvider = () => Promise<string>
export type GoogleDriveFetch = typeof fetch

interface GoogleDriveFileMetadata {
  id?: unknown
}

function requireSafeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} debe ser un entero seguro mayor o igual a cero.`)
  }
  return value
}

function requirePositiveSafeInteger(value: number, label: string): number {
  const checked = requireSafeNonNegativeInteger(value, label)
  if (checked <= 0) throw new Error(`${label} debe ser mayor que cero.`)
  return checked
}

function requireOpaqueIdentifier(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 160 || !/^[A-Za-z0-9._~-]+$/.test(normalized)) {
    throw new Error(`${label} no es un identificador opaco válido.`)
  }
  return normalized
}

function requireGoogleUploadSessionUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('La URL de sesión reanudable de Google Drive no es válida.')
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== DRIVE_UPLOAD_HOST ||
    url.pathname !== DRIVE_UPLOAD_PATH
  ) {
    throw new Error('OANIX rechazó una URL reanudable que no pertenece al endpoint de Google Drive.')
  }
  return url.toString()
}

function parseConfirmedCiphertextBytes(rangeHeader: string | null): number {
  if (!rangeHeader) return 0
  const match = /^bytes=0-(\d+)$/.exec(rangeHeader.trim())
  if (!match) throw new Error('Google Drive devolvió un rango de reanudación no válido.')
  const lastByte = Number(match[1])
  if (!Number.isSafeInteger(lastByte) || lastByte < 0) {
    throw new Error('Google Drive devolvió una posición de reanudación fuera de rango.')
  }
  return lastByte + 1
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  let detail = ''
  try {
    const text = await response.text()
    if (text) detail = text.slice(0, 240)
  } catch {
    // HTTP status remains enough to diagnose the provider failure.
  }
  return detail
    ? `${fallback} (${response.status}): ${detail}`
    : `${fallback} (${response.status}).`
}

async function requireAccessToken(provider: GoogleDriveAccessTokenProvider): Promise<string> {
  const token = (await provider()).trim()
  if (!token || /\s/.test(token)) {
    throw new Error('OANIX no recibió un token válido para Google Drive.')
  }
  return token
}

function authorizedHeaders(token: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function parseDriveFileId(response: Response): Promise<string> {
  let parsed: GoogleDriveFileMetadata
  try {
    parsed = await response.json() as GoogleDriveFileMetadata
  } catch {
    throw new Error('Google Drive completó la transferencia sin devolver metadatos válidos.')
  }
  if (typeof parsed.id !== 'string') {
    throw new Error('Google Drive completó la transferencia sin devolver el id remoto.')
  }
  return requireOpaqueIdentifier(parsed.id, 'El id remoto de Google Drive')
}

function statusFromResumeResponse(response: Response, expectedCiphertextBytes: number): LargeObjectUploadStatus {
  if (response.status === 308) {
    const confirmedCiphertextBytes = parseConfirmedCiphertextBytes(response.headers.get('Range'))
    if (confirmedCiphertextBytes > expectedCiphertextBytes) {
      throw new Error('Google Drive confirmó más bytes que el objeto cifrado esperado.')
    }
    return { confirmedCiphertextBytes, complete: false }
  }
  if (response.status === 200 || response.status === 201) {
    return { confirmedCiphertextBytes: expectedCiphertextBytes, complete: true }
  }
  if (response.status === 404 || response.status === 410) {
    throw new Error('La sesión reanudable de Google Drive expiró y debe reiniciarse.')
  }
  throw new Error(`Google Drive devolvió un estado inesperado de transferencia (${response.status}).`)
}

export class GoogleDriveStorageProvider implements OanixStorageProvider {
  readonly providerId = GOOGLE_DRIVE_PROVIDER_ID
  private readonly getAccessToken: GoogleDriveAccessTokenProvider
  private readonly fetchImpl: GoogleDriveFetch

  constructor(
    getAccessToken: GoogleDriveAccessTokenProvider,
    fetchImpl: GoogleDriveFetch = fetch,
  ) {
    this.getAccessToken = getAccessToken
    this.fetchImpl = fetchImpl
  }

  async beginResumableUpload(input: {
    objectId: string
    expectedCiphertextBytes: number
  }): Promise<LargeObjectUploadSession> {
    const objectId = requireOpaqueIdentifier(input.objectId, 'El objectId')
    const expectedCiphertextBytes = requirePositiveSafeInteger(
      input.expectedCiphertextBytes,
      'El tamaño cifrado esperado',
    )
    const token = await requireAccessToken(this.getAccessToken)
    const endpoint = `${DRIVE_UPLOAD_FILES_URL}?uploadType=resumable&fields=id`
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: authorizedHeaders(token, {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/octet-stream',
        'X-Upload-Content-Length': String(expectedCiphertextBytes),
      }),
      body: JSON.stringify({
        name: `${OPAQUE_FILE_PREFIX}${objectId}.bin`,
        parents: ['appDataFolder'],
        appProperties: {
          oanixObjectId: objectId,
          oanixFormat: 'large-object-v1',
        },
      }),
    })

    if (!response.ok) {
      throw new Error(await responseMessage(response, 'Google Drive no pudo iniciar la subida reanudable'))
    }
    const rawLocation = response.headers.get('Location')?.trim()
    if (!rawLocation) {
      throw new Error('Google Drive no devolvió una URL para reanudar la subida.')
    }
    const sessionRef = requireGoogleUploadSessionUrl(rawLocation)

    return {
      providerId: this.providerId,
      sessionRef,
      objectId,
      expectedCiphertextBytes,
    }
  }

  async inspectResumableUpload(session: LargeObjectUploadSession): Promise<LargeObjectUploadStatus> {
    this.validateSession(session)
    const token = await requireAccessToken(this.getAccessToken)
    const response = await this.fetchImpl(session.sessionRef, {
      method: 'PUT',
      headers: authorizedHeaders(token, {
        'Content-Range': `bytes */${session.expectedCiphertextBytes}`,
      }),
    })
    return statusFromResumeResponse(response, session.expectedCiphertextBytes)
  }

  async uploadCiphertextRange(request: LargeObjectUploadRangeRequest): Promise<LargeObjectUploadStatus> {
    this.validateSession(request.session)
    validateUploadRangeRequest(request)
    if (request.session.providerId !== this.providerId) {
      throw new Error('La sesión de subida pertenece a otro proveedor.')
    }
    const token = await requireAccessToken(this.getAccessToken)
    const start = requireSafeNonNegativeInteger(request.ciphertextOffset, 'El offset cifrado')
    const end = start + request.bytes.byteLength - 1
    const response = await this.fetchImpl(request.session.sessionRef, {
      method: 'PUT',
      headers: authorizedHeaders(token, {
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${end}/${request.totalCiphertextBytes}`,
      }),
      body: Uint8Array.from(request.bytes).buffer,
    })

    if (![200, 201, 308].includes(response.status)) {
      if (response.status === 404 || response.status === 410) {
        throw new Error('La sesión reanudable de Google Drive expiró y debe reiniciarse.')
      }
      throw new Error(await responseMessage(response, 'Google Drive rechazó un rango cifrado'))
    }
    return statusFromResumeResponse(response, request.totalCiphertextBytes)
  }

  async finalizeResumableUpload(session: LargeObjectUploadSession): Promise<LargeObjectRemoteObject> {
    this.validateSession(session)
    const token = await requireAccessToken(this.getAccessToken)
    const response = await this.fetchImpl(session.sessionRef, {
      method: 'PUT',
      headers: authorizedHeaders(token, {
        'Content-Range': `bytes */${session.expectedCiphertextBytes}`,
      }),
    })

    if (response.status === 308) {
      const status = statusFromResumeResponse(response, session.expectedCiphertextBytes)
      throw new Error(`Google Drive todavía espera bytes cifrados (${status.confirmedCiphertextBytes}/${session.expectedCiphertextBytes}).`)
    }
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(await responseMessage(response, 'Google Drive no pudo finalizar la subida'))
    }

    const objectRef = await parseDriveFileId(response)
    return {
      providerId: this.providerId,
      objectRef,
      ciphertextByteLength: session.expectedCiphertextBytes,
    }
  }

  async downloadCiphertextRange(request: LargeObjectDownloadRangeRequest): Promise<Uint8Array> {
    this.validateRemoteObject(request.remoteObject)
    const offset = requireSafeNonNegativeInteger(request.ciphertextOffset, 'El offset de descarga')
    const length = requirePositiveSafeInteger(request.ciphertextByteLength, 'El tamaño del rango de descarga')
    if (offset + length > request.remoteObject.ciphertextByteLength) {
      throw new Error('El rango solicitado excede el tamaño cifrado remoto.')
    }
    const token = await requireAccessToken(this.getAccessToken)
    const objectRef = encodeURIComponent(request.remoteObject.objectRef)
    const response = await this.fetchImpl(`${DRIVE_FILES_URL}/${objectRef}?alt=media`, {
      method: 'GET',
      headers: authorizedHeaders(token, {
        Range: `bytes=${offset}-${offset + length - 1}`,
      }),
    })
    if (response.status !== 206 && response.status !== 200) {
      throw new Error(await responseMessage(response, 'Google Drive no pudo descargar el rango cifrado'))
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength !== length) {
      bytes.fill(0)
      throw new Error('Google Drive devolvió un rango con longitud distinta a la solicitada.')
    }
    return bytes
  }

  async deleteRemoteObject(remoteObject: LargeObjectRemoteObject): Promise<void> {
    this.validateRemoteObject(remoteObject)
    const token = await requireAccessToken(this.getAccessToken)
    const objectRef = encodeURIComponent(remoteObject.objectRef)
    const response = await this.fetchImpl(`${DRIVE_FILES_URL}/${objectRef}`, {
      method: 'DELETE',
      headers: authorizedHeaders(token),
    })
    if (response.status !== 204 && response.status !== 404) {
      throw new Error(await responseMessage(response, 'Google Drive no pudo eliminar el objeto cifrado'))
    }
  }

  private validateSession(session: LargeObjectUploadSession): void {
    if (session.providerId !== this.providerId) {
      throw new Error('La sesión reanudable pertenece a otro proveedor.')
    }
    requireOpaqueIdentifier(session.objectId, 'El objectId de la sesión')
    requirePositiveSafeInteger(session.expectedCiphertextBytes, 'El tamaño cifrado de la sesión')
    requireGoogleUploadSessionUrl(session.sessionRef)
  }

  private validateRemoteObject(remoteObject: LargeObjectRemoteObject): void {
    if (remoteObject.providerId !== this.providerId) {
      throw new Error('El objeto remoto pertenece a otro proveedor.')
    }
    requireOpaqueIdentifier(remoteObject.objectRef, 'El id remoto')
    requirePositiveSafeInteger(remoteObject.ciphertextByteLength, 'El tamaño cifrado remoto')
  }
}
