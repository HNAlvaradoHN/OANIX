import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const renderer = readFileSync('src/features/editor/implementations/OanixMixedDocumentBody.tsx', 'utf8')
const cache = readFileSync('src/features/attachments/attachmentSessionCache.ts', 'utf8')

test('cached images can render from a session object URL on the first render', () => {
  assert.match(renderer, /getCachedAttachmentObjectUrl/)
  assert.match(renderer, /useState<string \| null>\(\(\) => \([\s\S]*getCachedAttachmentObjectUrl\(attachment\.id\)/)
  assert.match(renderer, /const \[requested, setRequested\] = useState\(Boolean\(url\)\)/)
  assert.match(renderer, /const cachedUrl = getCachedAttachmentObjectUrl\(attachment\.id\)[\s\S]*if \(cachedUrl\) \{[\s\S]*setUrl\(cachedUrl\)/)
})

test('session object URLs are owned by the cache and revoked with their cached file', () => {
  assert.match(cache, /objectUrl: string \| null/)
  assert.match(cache, /getObjectUrl\(attachmentId: string\): string \| null/)
  assert.match(cache, /URL\.createObjectURL\(existing\.file\)/)
  assert.match(cache, /URL\.revokeObjectURL\(existing\.objectUrl\)/)
  assert.match(cache, /for \(const existing of this\.files\.values\(\)\) this\.revokeObjectUrl\(existing\)/)
})

test('renderer only revokes fallback URLs that it owns itself', () => {
  assert.match(renderer, /componentOwnedUrlRef/)
  assert.match(renderer, /componentOwnedUrlRef\.current = objectUrl/)
  assert.match(renderer, /if \(componentOwnedUrlRef\.current\) URL\.revokeObjectURL\(componentOwnedUrlRef\.current\)/)
})
