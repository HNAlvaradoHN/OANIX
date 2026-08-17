import {
  createVaultProtectionFromRecoveryKey,
  exportVaultKeyForRecovery,
  validateMasterPassword,
} from '../../security/crypto/vaultCrypto'
import { verifyLocalEncryption } from '../../security/vault/vaultService'
import {
  readVaultMetadata,
  writeVaultMetadata,
  type VaultMetadata,
} from '../../storage/repositories/vaultRepository'
import {
  getOnlineAccountSession,
  getOnlineDataClient,
} from '../account/accountService'
import { syncEncryptedBinariesBidirectional } from '../sync/binarySyncService'
import { restoreSyncedVaultToThisDevice } from '../sync/syncService'

const VAULT_BOOTSTRAP_KEY = 'vault-bootstrap-v1'
const VAULT_BOOTSTRAP_PROTOCOL = 'oanix-vault-bootstrap-v1' as const
const RECOVERY_FUNCTION = 'vault-recovery-broker'

interface RemoteVaultBootstrap {
  protocol: typeof VAULT_BOOTSTRAP_PROTOCOL
  metadata: VaultMetadata
}

interface BootstrapRow {
  record_key: string
  ciphertext: string | null
  version: number
  deleted: boolean
}

interface RecoveryStatusResponse {
  prepared: boolean
  generation: number | null
}

interface RecoveryKeyResponse {
  vaultKey: string
  generation: number
}

export interface EmailRecoveryResult {
  recordCount: number
  binaryWarning: string
}

export type EmailRecoveryDelivery = 'sent' | 'uncertain'

function normalizeEmail(rawEmail: string) {
  return rawEmail.trim().toLocaleLowerCase()
}

function getRecoveryRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

function parseBootstrap(ciphertext: string | null): RemoteVaultBootstrap {
  if (!ciphertext) throw new Error('La bóveda sincronizada no tiene metadatos de acceso válidos.')

  let parsed: unknown
  try {
    parsed = JSON.parse(ciphertext)
  } catch {
    throw new Error('Los metadatos de acceso de la bóveda sincronizada son ilegibles.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Los metadatos de acceso de la bóveda sincronizada son inválidos.')
  }

  const candidate = parsed as Partial<RemoteVaultBootstrap>
  if (
    candidate.protocol !== VAULT_BOOTSTRAP_PROTOCOL
    || !candidate.metadata
    || candidate.metadata.key !== 'primary'
    || candidate.metadata.schemaVersion !== 1
    || candidate.metadata.protection === 'pending'
  ) {
    throw new Error('Esta versión de OANIX no reconoce la protección de la bóveda sincronizada.')
  }

  return candidate as RemoteVaultBootstrap
}

function requireBootstrapRow(value: unknown): BootstrapRow {
  if (!value || typeof value !== 'object') throw new Error('Supabase devolvió metadatos inválidos.')
  const row = value as Partial<BootstrapRow>
  if (
    row.record_key !== VAULT_BOOTSTRAP_KEY
    || typeof row.version !== 'number'
    || !Number.isSafeInteger(row.version)
    || row.version <= 0
    || typeof row.deleted !== 'boolean'
  ) {
    throw new Error('Supabase devolvió metadatos de bóveda inválidos.')
  }
  return row as BootstrapRow
}

async function invokeRecoveryBroker<T>(body: Record<string, unknown>): Promise<T> {
  const client = getOnlineDataClient()
  const { data, error } = await client.functions.invoke(RECOVERY_FUNCTION, { body })

  if (error) {
    const fallback = error.message || 'No se pudo completar la operación de recuperación.'
    throw new Error(fallback)
  }

  if (!data || typeof data !== 'object') {
    throw new Error('El servicio de recuperación devolvió una respuesta inválida.')
  }

  if ('error' in data && typeof data.error === 'string') {
    throw new Error(data.error)
  }

  return data as T
}

async function fetchRemoteBootstrap(): Promise<{ row: BootstrapRow; bootstrap: RemoteVaultBootstrap }> {
  const session = await getOnlineAccountSession()
  if (!session) throw new Error('Primero inicia sesión en tu cuenta de OANIX.')

  const client = getOnlineDataClient()
  const { data, error } = await client
    .from('sync_records')
    .select('record_key, ciphertext, version, deleted')
    .eq('user_id', session.userId)
    .eq('record_key', VAULT_BOOTSTRAP_KEY)
    .single()

  if (error || !data) {
    throw new Error('Esta cuenta todavía no tiene una bóveda sincronizada disponible.')
  }

  const row = requireBootstrapRow(data)
  if (row.deleted) throw new Error('La bóveda sincronizada de esta cuenta fue eliminada.')
  return { row, bootstrap: parseBootstrap(row.ciphertext) }
}

async function replaceRemoteBootstrap(
  row: BootstrapRow,
  metadata: VaultMetadata,
): Promise<void> {
  const session = await getOnlineAccountSession()
  if (!session) throw new Error('La sesión de recuperación ya no está disponible.')

  const nextBootstrap: RemoteVaultBootstrap = {
    protocol: VAULT_BOOTSTRAP_PROTOCOL,
    metadata,
  }

  const client = getOnlineDataClient()
  const { data, error } = await client
    .from('sync_records')
    .update({
      ciphertext: JSON.stringify(nextBootstrap),
      version: row.version + 1,
      deleted: false,
    })
    .eq('user_id', session.userId)
    .eq('record_key', VAULT_BOOTSTRAP_KEY)
    .eq('version', row.version)
    .select('record_key')
    .single()

  if (error || !data) {
    throw new Error('La seguridad de la bóveda cambió en otro dispositivo. Vuelve a iniciar la recuperación para no sobrescribirla.')
  }
}

export async function getEmailRecoveryStatus(): Promise<RecoveryStatusResponse> {
  const result = await invokeRecoveryBroker<RecoveryStatusResponse>({ action: 'status' })
  return {
    prepared: result.prepared === true,
    generation: typeof result.generation === 'number' ? result.generation : null,
  }
}

export async function prepareEmailRecoveryForCurrentVault(masterPassword: string): Promise<void> {
  const session = await getOnlineAccountSession()
  if (!session) return

  const metadata = await readVaultMetadata()
  if (!metadata || metadata.protection === 'pending') {
    throw new Error('La bóveda local todavía no está lista para preparar recuperación.')
  }

  const status = await getEmailRecoveryStatus()
  const generation = Math.max(
    1,
    metadata.securityGeneration ?? 1,
    status.generation ?? 1,
  )

  const encodedVaultKey = await exportVaultKeyForRecovery(masterPassword, metadata.protection)
  await invokeRecoveryBroker<{ ok: boolean; generation: number }>({
    action: 'register',
    vaultKey: encodedVaultKey,
    generation,
  })

  if (metadata.securityGeneration !== generation) {
    await writeVaultMetadata({ ...metadata, securityGeneration: generation })
  }
}

export async function requestEmailRecoveryCode(rawEmail: string): Promise<EmailRecoveryDelivery> {
  const email = normalizeEmail(rawEmail)
  if (!email || !email.includes('@')) throw new Error('No hay un correo válido para recuperar esta bóveda.')

  const client = getOnlineDataClient()
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: getRecoveryRedirectUrl(),
      },
    })

    if (error) {
      const message = error.message.toLocaleLowerCase().includes('rate')
        ? 'Se alcanzó temporalmente el límite de códigos. Espera un momento y vuelve a intentarlo.'
        : error.message
      throw new Error(message || 'No se pudo enviar el código de recuperación.')
    }
    return 'sent'
  } catch (error) {
    const message = error instanceof Error ? error.message.toLocaleLowerCase() : ''
    if (message.includes('failed to fetch') || error instanceof TypeError) {
      return 'uncertain'
    }
    throw error
  }
}

async function verifyEmailRecoveryCode(rawEmail: string, rawCode: string): Promise<void> {
  const email = normalizeEmail(rawEmail)
  const token = rawCode.trim()
  if (!/^\d{6,8}$/.test(token)) throw new Error('Escribe el código numérico que llegó a tu correo.')

  const client = getOnlineDataClient()
  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error || !data.session) {
    throw new Error('El código es incorrecto, venció o ya fue utilizado.')
  }
}

export async function completeEmailVaultRecovery(
  email: string,
  code: string,
  newPassword: string,
): Promise<EmailRecoveryResult> {
  const validationMessage = validateMasterPassword(newPassword)
  if (validationMessage) throw new Error(validationMessage)

  await verifyEmailRecoveryCode(email, code)

  const recovered = await invokeRecoveryBroker<RecoveryKeyResponse>({ action: 'recover' })
  if (
    typeof recovered.vaultKey !== 'string'
    || typeof recovered.generation !== 'number'
    || !Number.isSafeInteger(recovered.generation)
    || recovered.generation <= 0
  ) {
    throw new Error('El servicio de recuperación devolvió una clave inválida.')
  }

  const { row, bootstrap } = await fetchRemoteBootstrap()
  const nextGeneration = recovered.generation + 1
  const protection = await createVaultProtectionFromRecoveryKey(newPassword, recovered.vaultKey)
  const nextMetadata: VaultMetadata = {
    ...bootstrap.metadata,
    protection,
    securityGeneration: nextGeneration,
  }

  await replaceRemoteBootstrap(row, nextMetadata)

  let rotationWarning = ''
  try {
    await invokeRecoveryBroker<{ ok: boolean; generation: number }>({
      action: 'register',
      vaultKey: recovered.vaultKey,
      generation: nextGeneration,
    })
  } catch (error) {
    rotationWarning = error instanceof Error
      ? `La contraseña se cambió, pero OANIX no pudo rotar todavía la envoltura de recuperación: ${error.message}`
      : 'La contraseña se cambió, pero la envoltura de recuperación se reintentará más adelante.'
  }

  const restored = await restoreSyncedVaultToThisDevice(newPassword)
  const verification = await verifyLocalEncryption()
  if (verification.status === 'error') throw new Error(verification.message)

  let binaryWarning = rotationWarning
  try {
    const binaryResult = await syncEncryptedBinariesBidirectional()
    if (binaryResult.conflicts > 0) {
      const conflictMessage = `${binaryResult.conflicts} imagen${binaryResult.conflicts === 1 ? '' : 'es'} requiere${binaryResult.conflicts === 1 ? '' : 'n'} revisión de conflicto.`
      binaryWarning = binaryWarning ? `${binaryWarning} ${conflictMessage}` : conflictMessage
    }
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Las imágenes se reintentarán mediante la sincronización automática.'
    binaryWarning = binaryWarning ? `${binaryWarning} ${message}` : message
  }

  return {
    recordCount: restored.recordCount,
    binaryWarning,
  }
}
