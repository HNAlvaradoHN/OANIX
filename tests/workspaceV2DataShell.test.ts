import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/workspaceV2/WorkspaceV2ListPane.tsx', 'utf8')
const css = readFileSync('src/features/workspaceV2/workspaceV2.css', 'utf8')

test('workspace v2 list shell hydrates only from real encrypted-domain services', () => {
  for (const required of [
    "loadFolders()",
    "loadTags()",
    "loadNotes()",
    "loadFolderColors()",
    "loadFolderIcons()",
    'visualDescription',
    'visualCategoryTagId',
    'visualIcon',
    'visualColor',
  ]) {
    assert.ok(source.includes(required), `missing ${required}`)
  }

  assert.doesNotMatch(source, /datos\.js|localStorage|sessionStorage/)
  assert.doesNotMatch(source, /https?:\/\//)
})

test('workspace v2 visual surface is strictly namespaced and reduced-motion aware', () => {
  assert.match(source, /className="oanix-workspace-v2"/)
  assert.match(css, /^\.oanix-workspace-v2\s*\{/m)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css, /(^|\n)\s*(html|body|:root|button|input|main|aside)\s*[,{]/)
})
