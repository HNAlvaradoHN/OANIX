import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isTransientStorageError,
  retryTransientStorageOperation,
  storageSaveErrorMessage,
} from '../src/storage/local/storageErrors.ts'

function namedError(name: string, message = name): Error {
  const error = new Error(message)
  error.name = name
  return error
}

test('retries transient IndexedDB failures once', async () => {
  let attempts = 0
  const value = await retryTransientStorageOperation(async () => {
    attempts += 1
    if (attempts === 1) throw namedError('AbortError')
    return 'saved'
  }, 2, 0)

  assert.equal(value, 'saved')
  assert.equal(attempts, 2)
})

test('does not retry quota failures', async () => {
  let attempts = 0
  await assert.rejects(
    retryTransientStorageOperation(async () => {
      attempts += 1
      throw namedError('QuotaExceededError')
    }, 2, 0),
  )
  assert.equal(attempts, 1)
})

test('maps common save failures to actionable messages', () => {
  assert.equal(isTransientStorageError(namedError('UnknownError')), true)
  assert.match(storageSaveErrorMessage(namedError('QuotaExceededError')), /espacio local/i)
  assert.match(storageSaveErrorMessage(new Error('The OANIX vault is locked.')), /bóveda/i)
  assert.match(storageSaveErrorMessage(new Error('The local database upgrade is blocked by another OANIX tab.')), /pestaña/i)
})
