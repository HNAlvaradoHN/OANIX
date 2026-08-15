import assert from 'node:assert/strict'
import test from 'node:test'
import { applyFolderOrder, moveFolderId, type FolderRecord } from '../src/features/folders/folderTypes.ts'

function folder(id: string, name: string): FolderRecord {
  return { version: 1, id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
}

test('saved folder order wins over alphabetical order', () => {
  const folders = [folder('a', 'Alpha'), folder('b', 'Beta'), folder('c', 'Gamma')]
  assert.deepEqual(applyFolderOrder(folders, ['c', 'a', 'b']).map((item) => item.id), ['c', 'a', 'b'])
})

test('folders missing from an older order record remain available', () => {
  const folders = [folder('a', 'Alpha'), folder('b', 'Beta'), folder('c', 'Gamma')]
  assert.deepEqual(applyFolderOrder(folders, ['b']).map((item) => item.id), ['b', 'a', 'c'])
})

test('folder order moves one position and respects boundaries', () => {
  assert.deepEqual(moveFolderId(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c'])
  assert.deepEqual(moveFolderId(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b'])
  assert.deepEqual(moveFolderId(['a', 'b', 'c'], 'a', 'up'), ['a', 'b', 'c'])
  assert.deepEqual(moveFolderId(['a', 'b', 'c'], 'c', 'down'), ['a', 'b', 'c'])
})
