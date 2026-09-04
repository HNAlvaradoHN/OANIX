import assert from 'node:assert/strict'
import test from 'node:test'
import { CONTACT_BLOCK_KIND, decodeContactBlock, encodeContactBlock } from '../src/features/editor/contactBlockCodec.ts'

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
