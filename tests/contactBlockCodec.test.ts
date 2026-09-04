import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CONTACT_BLOCK_KIND,
  decodeContactBlock,
  encodeContactBlock,
  isValidContactEmail,
  sanitizeContactPhone,
} from '../src/features/editor/contactBlockCodec.ts'

test('contact block codec round-trips all private card fields', () => {
  const encoded = encodeContactBlock({
    id: 'contact-1',
    kind: CONTACT_BLOCK_KIND,
    name: 'Ana López',
    phone: '+504 9999-0000',
    email: 'ana@example.com',
    organization: 'OANIX',
    notes: 'Contacto de prueba',
  })
  assert.deepEqual(decodeContactBlock(encoded), {
    id: 'contact-1',
    kind: CONTACT_BLOCK_KIND,
    name: 'Ana López',
    phone: '+504 9999-0000',
    email: 'ana@example.com',
    organization: 'OANIX',
    notes: 'Contacto de prueba',
  })
})

test('contact codec requires every persisted string field', () => {
  assert.equal(decodeContactBlock({ id: 'bad', kind: CONTACT_BLOCK_KIND, data: { name: 'Ana' } }), null)
})

test('phone sanitizer keeps only digits and does not assume a country code', () => {
  assert.equal(sanitizeContactPhone('+504 9999-0000'), '50499990000')
  assert.equal(sanitizeContactPhone('+1 (212) 555-0198 ext 4'), '121255501984')
})

test('email validator accepts complete addresses and rejects malformed values', () => {
  assert.equal(isValidContactEmail(''), true)
  assert.equal(isValidContactEmail('ana@example.com'), true)
  assert.equal(isValidContactEmail('ana@correo.hn'), true)
  assert.equal(isValidContactEmail('ana@correo'), false)
  assert.equal(isValidContactEmail('ana@@correo.com'), false)
  assert.equal(isValidContactEmail('ana correo@example.com'), false)
})
