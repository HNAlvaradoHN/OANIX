import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const nodeVersion = readFileSync('.nvmrc', 'utf8').trim()
const workflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/android.yml',
  '.github/workflows/pages.yml',
] as const

test('GitHub workflows share one Node.js version authority', () => {
  assert.equal(nodeVersion, '22')

  for (const path of workflows) {
    const workflow = readFileSync(path, 'utf8')
    const setupCount = workflow.match(/uses:\s*actions\/setup-node@v4/g)?.length ?? 0
    const authorityCount = workflow.match(/node-version-file:\s*\.nvmrc/g)?.length ?? 0

    assert.ok(setupCount > 0, `${path} should configure Node.js explicitly`)
    assert.equal(authorityCount, setupCount, `${path} should use .nvmrc for every setup-node step`)
    assert.doesNotMatch(workflow, /node-version:\s*['"]?\d+/)
  }
})
