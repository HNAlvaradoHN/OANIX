import assert from 'node:assert/strict'
import test from 'node:test'

import { createControlledLargeObjectId } from '../src/features/largeObjects/controlledLargeObjectIdentity.ts'

const SAMPLE_BYTES = 64 * 1024

function fakeFile(bytes: Uint8Array, lastModified = 123456789): File {
  return {
    size: bytes.byteLength,
    lastModified,
    slice(start = 0, end = bytes.byteLength) {
      return new Blob([bytes.slice(start, end)])
    },
  } as File
}

test('controlled large-object identity is stable for the same file samples', async () => {
  const bytes = new Uint8Array(128 * 1024)
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251
  const file = fakeFile(bytes)

  const first = await createControlledLargeObjectId(file)
  const second = await createControlledLargeObjectId(file)

  assert.equal(first, second)
  assert.match(first, /^field-[a-f0-9]{64}$/u)
})

test('controlled large-object identity changes when the sampled content changes', async () => {
  const firstBytes = new Uint8Array(128 * 1024)
  const secondBytes = firstBytes.slice()
  secondBytes[secondBytes.length - 1] = 1

  const first = await createControlledLargeObjectId(fakeFile(firstBytes))
  const second = await createControlledLargeObjectId(fakeFile(secondBytes))

  assert.notEqual(first, second)
})

test('controlled identity samples only the beginning and end instead of reading the whole file', async () => {
  const size = 150 * 1024 * 1024
  const slices: Array<[number, number]> = []
  const file = {
    size,
    lastModified: 123,
    slice(start = 0, end = size) {
      slices.push([start, end])
      return new Blob([new Uint8Array(end - start)])
    },
  } as File

  await createControlledLargeObjectId(file)

  assert.deepEqual(slices, [
    [0, SAMPLE_BYTES],
    [size - SAMPLE_BYTES, size],
  ])
})
