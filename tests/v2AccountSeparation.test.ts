import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('V2 account remains isolated from the local master password and sync payloads', () => {
  const service = readFileSync('src/features/account/accountService.ts', 'utf8')
  const panel = readFileSync('src/features/account/AccountPanel.tsx', 'utf8')
  const app = readFileSync('src/app/App.tsx', 'utf8')
  const styles = readFileSync('src/features/account/account.css', 'utf8')

  assert.match(service, /createOnlineAccount/)
  assert.match(service, /supabase\.auth\.signUp/)
  assert.match(service, /supabase\.auth\.signInWithPassword/)
  assert.match(service, /supabase\.auth\.signInWithOAuth/)
  assert.match(service, /provider: 'google'/)
  assert.match(service, /supabase\.auth\.getSession/)
  assert.match(service, /supabase\.auth\.onAuthStateChange/)
  assert.match(service, /supabase\.auth\.signOut/)
  assert.match(service, /persistSession: true/)
  assert.match(service, /SUPABASE_PUBLISHABLE_KEY/)
  assert.doesNotMatch(service, /vaultService|unlockLocalVault|createMasterPassword|encrypted_records/)
  assert.doesNotMatch(service, /from ['"][^'"]*\/sync(?:\/|['"])/)
  assert.doesNotMatch(service, /syncService|syncPayload|synchronizeRecords/)
  assert.doesNotMatch(service, /gmail|googleapis\.com\/auth\/gmail|drive\.google|contacts\.google/i)

  assert.match(panel, /Modo local siempre disponible/)
  assert.match(panel, /Continuar con Google/)
  assert.match(panel, /Iniciar sesión/)
  assert.match(panel, /Crear cuenta/)
  assert.match(panel, /Seguir en modo local/)
  assert.match(panel, /Cerrar sesión online/)
  assert.match(panel, /(separada de|independiente de) tu contraseña maestra/)
  assert.match(panel, /Sincronización todavía desactivada/)

  assert.match(app, /createPortal/)
  assert.match(app, /\.notes-header__actions/)
  assert.match(app, /account-header-action/)
  assert.doesNotMatch(app, /account-launcher/)
  assert.match(styles, /\.account-header-action/)
  assert.doesNotMatch(styles, /\.account-launcher/)
})
