import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearLargeObjectTransferUi,
  createLargeObjectTransferUiReporter,
  getLargeObjectTransferUiSnapshot,
  markLargeObjectTransferFailed,
  markLargeObjectTransferPaused,
  markLargeObjectTransferResuming,
} from '../src/features/largeObjects/largeObjectTransferUiStore.ts'
import { createLargeObjectTransferProgress } from '../src/features/largeObjects/largeObjectProtocol.ts'

const meta = {
  objectId: 'object-progress-001',
  fileName: 'video-prueba.mp4',
  mimeType: 'video/mp4',
}

test('transfer UI keeps verifying distinct from stored', () => {
  clearLargeObjectTransferUi()
  const report = createLargeObjectTransferUiReporter(meta)

  report(createLargeObjectTransferProgress('verifying', 200, 200))
  const verifying = getLargeObjectTransferUiSnapshot()
  assert.equal(verifying?.phase, 'verifying')
  assert.equal(verifying?.percent, 99.99)

  report(createLargeObjectTransferProgress('stored', 200, 200))
  const stored = getLargeObjectTransferUiSnapshot()
  assert.equal(stored?.phase, 'stored')
  assert.equal(stored?.percent, 100)
})

test('transfer UI preserves progress while paused, resuming and failed', () => {
  clearLargeObjectTransferUi()
  const report = createLargeObjectTransferUiReporter(meta)
  report(createLargeObjectTransferProgress('uploading', 75, 200))

  markLargeObjectTransferPaused()
  assert.deepEqual(
    {
      phase: getLargeObjectTransferUiSnapshot()?.phase,
      processedBytes: getLargeObjectTransferUiSnapshot()?.processedBytes,
      message: getLargeObjectTransferUiSnapshot()?.message,
    },
    { phase: 'paused', processedBytes: 75, message: 'Esperando conexión' },
  )

  markLargeObjectTransferResuming()
  assert.equal(getLargeObjectTransferUiSnapshot()?.phase, 'resuming')
  assert.equal(getLargeObjectTransferUiSnapshot()?.processedBytes, 75)

  markLargeObjectTransferFailed(new Error('Red interrumpida'))
  assert.equal(getLargeObjectTransferUiSnapshot()?.phase, 'failed')
  assert.equal(getLargeObjectTransferUiSnapshot()?.message, 'Red interrumpida')
})
