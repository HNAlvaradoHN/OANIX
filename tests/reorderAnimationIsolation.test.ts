import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const folders = readFileSync('src/features/folders/folderInteractive.css', 'utf8')
const tags = readFileSync('src/features/notes/organicWorkspace.css', 'utf8')

test('folder reorder state does not animate transform while FLIP owns reflow', () => {
  assert.doesNotMatch(folders, /oanix-folder-jiggle/)
  const start = folders.indexOf('.oanix-folder-grid--reordering .oanix-folder-rail__item[data-oanix-folder-id]')
  assert.ok(start >= 0)
  const block = folders.slice(start, folders.indexOf('}', start) + 1)
  assert.doesNotMatch(block, /animation\s*:/)
  assert.doesNotMatch(block, /transform\s*:/)
  assert.match(block, /outline:/)
})

test('tag reorder siblings keep transform free for slot reflow animations', () => {
  assert.doesNotMatch(tags, /oanix-organic-jiggle/)
  const start = tags.indexOf('.oanix-organic-tags.is-reordering .oanix-organic-tag-chip[data-oanix-organic-tag-id]')
  assert.ok(start >= 0)
  const block = tags.slice(start, tags.indexOf('}', start) + 1)
  assert.doesNotMatch(block, /animation\s*:/)
  assert.doesNotMatch(block, /transform\s*:/)
  assert.match(block, /outline:/)
})
