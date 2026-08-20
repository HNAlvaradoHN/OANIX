import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createNotePrivacyLock,
  NOTE_LOCK_MAX_CHARACTERS,
  validateNotePrivacyCode,
  verifyNotePrivacyLock,
} from '../src/features/privacy/notePrivacyCrypto.ts'

const runtimeSource = readFileSync('src/features/privacy/NotePrivacyRuntime.tsx', 'utf8')
const privacySource = readFileSync('src/features/privacy/notePrivacyService.ts', 'utf8')
const authSource = readFileSync('src/features/privacy/privateBoxAuth.ts', 'utf8')
const appSource = readFileSync('src/app/App.tsx', 'utf8')

test('note codes accept any 1 to 20 characters without composition rules', () => {
  assert.equal(validateNotePrivacyCode('1'), null)
  assert.equal(validateNotePrivacyCode('a'), null)
  assert.equal(validateNotePrivacyCode('!'), null)
  assert.equal(validateNotePrivacyCode('🥰'), null)
  assert.equal(validateNotePrivacyCode('x'.repeat(NOTE_LOCK_MAX_CHARACTERS)), null)
  assert.match(validateNotePrivacyCode('') ?? '', /entre 1 y 20 caracteres/)
  assert.match(validateNotePrivacyCode('x'.repeat(NOTE_LOCK_MAX_CHARACTERS + 1)) ?? '', /entre 1 y 20 caracteres/)
})

test('note code verifier is salted PBKDF2 and never stores the plaintext code', async () => {
  const code = 'A7!privado'
  const lock = await createNotePrivacyLock(code)
  const serialized = JSON.stringify(lock)

  assert.equal(lock.algorithm, 'PBKDF2-SHA256')
  assert.ok(lock.iterations >= 100_000)
  assert.ok(lock.salt.length > 0)
  assert.ok(lock.verifier.length > 0)
  assert.equal(serialized.includes(code), false)
  assert.equal(await verifyNotePrivacyLock(code, lock), true)
  assert.equal(await verifyNotePrivacyLock('incorrecto', lock), false)
})

test('privacy metadata is itself stored as an encrypted vault record', () => {
  assert.match(privacySource, /NOTE_PRIVACY_RECORD_TYPE = 'note\.privacy'/)
  assert.match(privacySource, /writeEncryptedRecord\(NOTE_PRIVACY_RECORD_TYPE/)
  assert.match(privacySource, /readEncryptedRecord<unknown>\(NOTE_PRIVACY_RECORD_TYPE/)
  assert.doesNotMatch(privacySource, /localStorage|sessionStorage/)
})

test('protected notes hide content search locations while preserving title-only discovery', () => {
  assert.match(runtimeSource, /searchHidden = query\.length > 0 && locked && !titleMatches/)
  assert.match(runtimeSource, /dataset\.oanixNoteLocked/)
  assert.match(runtimeSource, /Búsqueda privada/)
  assert.match(runtimeSource, /notas protegidas: solo título/)
})

test('private box is absent from normal lists and requires reauthentication', () => {
  assert.match(runtimeSource, /privateHidden = privacy\?\.privateBox === true/)
  assert.match(runtimeSource, /Caja privada/)
  assert.match(runtimeSource, /requestPrivateAuthentication/)
  assert.match(authSource, /unlockAndroidBiometricVault\(binding\)/)
  assert.match(authSource, /openVaultProtection\(password, metadata\.protection\)/)
  assert.doesNotMatch(authSource, /setActiveVaultKey|clearActiveVaultKey/)
})

test('note privacy runtime is scoped to an unlocked vault session', () => {
  assert.match(appSource, /<NotesWorkspace key=\{workspaceRevision\}/)
  assert.match(appSource, /<NotePrivacyRuntime key=\{`privacy-\$\{workspaceRevision\}-\$\{privacyRevision\}`\} \/>/)
  assert.match(appSource, /<NoteBulkPrivacyRuntime key=\{`privacy-bulk-\$\{workspaceRevision\}`\} \/>/)
  assert.match(appSource, /window\.addEventListener\(NOTE_PRIVACY_REFRESH_EVENT, refreshPrivacy\)/)
  assert.match(appSource, /renderUnlocked=\{\(lockVault\) => <UnlockedApp lockVault=\{lockVault\} \/>\}/)
})
