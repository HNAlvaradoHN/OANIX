import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const brokerUrl = new URL('../supabase/functions/vault-recovery-broker/index.ts', import.meta.url)

async function readBrokerSource() {
  return await readFile(brokerUrl, 'utf8')
}

test('recovery broker answers browser CORS preflight before POST enforcement', async () => {
  const source = await readBrokerSource()

  assert.match(source, /req\.method === ['"]OPTIONS['"]/) 
  assert.match(source, /status:\s*204/)
  assert.match(source, /Access-Control-Allow-Origin/)
  assert.match(source, /Access-Control-Allow-Headers/)
  assert.match(source, /Access-Control-Allow-Methods/)
})

test('recovery broker returns CORS headers on JSON responses too', async () => {
  const source = await readBrokerSource()

  assert.match(source, /function json\([\s\S]*\.\.\.corsHeaders/)
  assert.match(source, /authorization, x-client-info, apikey, content-type/)
  assert.match(source, /POST, OPTIONS/)
})
