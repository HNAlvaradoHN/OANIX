const OBJECT_API_ENV = 'VITE_OANIX_OBJECT_API_URL'

function configuredBaseUrl(): string | null {
  const raw = import.meta.env.VITE_OANIX_OBJECT_API_URL?.trim()
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${OBJECT_API_ENV} no contiene una URL válida.`)
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('El API de objetos OANIX debe usar HTTPS.')
  }
  return url.toString().replace(/\/$/, '')
}

export function isR2ObjectApiConfigured(): boolean {
  return configuredBaseUrl() !== null
}

function objectUrl(objectKey: string): string {
  if (!objectKey || objectKey.includes('/') || objectKey.length > 240) {
    throw new Error('La clave del objeto remoto no es válida.')
  }
  const baseUrl = configuredBaseUrl()
  if (!baseUrl) throw new Error('El almacenamiento R2 de OANIX todavía no está configurado.')
  return `${baseUrl}/v1/objects/${encodeURIComponent(objectKey)}`
}

async function checkedFetch(
  objectKey: string,
  accessToken: string,
  init: RequestInit,
): Promise<Response> {
  if (!accessToken) throw new Error('La sesión online no tiene autorización para el almacenamiento remoto.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(objectUrl(objectKey), { ...init, headers })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const suffix = body ? `: ${body.slice(0, 180)}` : ''
    throw new Error(`R2 respondió ${response.status}${suffix}`)
  }
  return response
}

export async function putEncryptedR2Object(
  objectKey: string,
  accessToken: string,
  ciphertext: string,
): Promise<void> {
  await checkedFetch(objectKey, accessToken, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: ciphertext,
  })
}

export async function getEncryptedR2Object(
  objectKey: string,
  accessToken: string,
): Promise<string> {
  const response = await checkedFetch(objectKey, accessToken, { method: 'GET' })
  return response.text()
}

export async function deleteEncryptedR2Object(
  objectKey: string,
  accessToken: string,
): Promise<void> {
  await checkedFetch(objectKey, accessToken, { method: 'DELETE' })
}
