import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('v2 automatic sync waits for idle time and never applies remote work over an open editor', () => {
  const runtime = readFileSync('src/features/sync/V2AutoSyncRuntime.tsx', 'utf8')
  const app = readFileSync('src/app/App.tsx', 'utf8')

  assert.match(runtime, /const IDLE_DELAY_MS = 3000/)
  assert.match(runtime, /data-oanix-save-and-close/)
  assert.match(runtime, /controllerRef\.current\?\.abort\(\)/)
  assert.match(runtime, /\.gt\('change_seq'|runV2IncrementalSync/)
  assert.match(runtime, /onRemoteApplied\?\.\(\)/)
  assert.match(app, /<V2AutoSyncRuntime onRemoteApplied=/)
  assert.match(app, /<RebuildApp key=\{workspaceRevision\}/)
})
