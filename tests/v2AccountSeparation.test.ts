import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('V2 account remains isolated from the local master password and sync payloads', () => {
  const service = readFileSync('src/features/account/accountService.ts', 'utf8')
  const panel = readFileSync('src/features/account/AccountPanel.tsx', 'utf8')

  assert.match(service, /createOnlineAccount/)
  assert.match(service, /supabase\.auth\.signUp/)
  assert.match(service, /SUPABASE_PUBLISHABLE_KEY/)
  assert.doesNotMatch(service, /vaultService|unlockLocalVault|createMasterPassword|encrypted_records/)
  assert.doesNotMatch(service, /from ['"][^'"]*\/sync(?:\/|['"])/)
  assert.doesNotMatch(service, /syncService|syncPayload|synchronizeRecords/)
  assert.match(panel, /independiente de tu contraseña maestra/)
  assert.match(panel, /Sincronización todavía desactivada/)
})
