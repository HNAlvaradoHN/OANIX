const TRANSIENT_STORAGE_ERROR_NAMES = new Set([
  'AbortError',
  'InvalidStateError',
  'TransactionInactiveError',
  'UnknownError',
])

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : ''
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '')
}

export function isTransientStorageError(error: unknown): boolean {
  return TRANSIENT_STORAGE_ERROR_NAMES.has(errorName(error))
}

export function storageSaveErrorMessage(error: unknown): string {
  const name = errorName(error)
  const message = errorMessage(error).toLowerCase()

  if (name === 'QuotaExceededError') {
    return 'No hay espacio local suficiente para guardar esta nota. Libera almacenamiento del dispositivo y vuelve a intentarlo.'
  }

  if (message.includes('vault is locked') || message.includes('bóveda') && message.includes('bloque')) {
    return 'La bóveda ya no está desbloqueada. Vuelve a desbloquear OANIX antes de continuar.'
  }

  if (message.includes('upgrade is blocked') || message.includes('database upgrade is blocked')) {
    return 'Otra pestaña o ventana de OANIX está bloqueando el almacenamiento local. Ciérrala y vuelve a intentarlo.'
  }

  if (message.includes('indexeddb is not available')) {
    return 'Este navegador no está permitiendo usar el almacenamiento local de OANIX.'
  }

  return 'No se pudieron guardar los cambios cifrados de la nota. Pulsa Reintentar; si vuelve a ocurrir, OANIX mostrará este aviso sin cerrar la nota.'
}

export async function retryTransientStorageOperation<T>(
  operation: () => Promise<T>,
  attempts = 2,
  retryDelayMs = 70,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt >= attempts || !isTransientStorageError(error)) throw error
      if (retryDelayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs))
      }
    }
  }

  throw lastError
}
