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

test('workflows that install npm dependencies reuse the package-manager cache', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
  const android = readFileSync('.github/workflows/android.yml', 'utf8')
  const pages = readFileSync('.github/workflows/pages.yml', 'utf8')
  const [pagesBuild = '', pagesDeploy = ''] = pages.split(/\n  deploy:\n/, 2)

  for (const [path, workflow] of [
    ['.github/workflows/ci.yml', ci],
    ['.github/workflows/android.yml', android],
    ['.github/workflows/pages.yml build job', pagesBuild],
  ] as const) {
    assert.match(workflow, /run:\s*npm ci --no-audit --no-fund/)
    assert.match(workflow, /node-version-file:\s*\.nvmrc\s*\n\s*cache:\s*npm/,
      `${path} should enable setup-node npm caching before npm ci`)
  }

  assert.doesNotMatch(pagesDeploy, /run:\s*npm ci/)
  assert.doesNotMatch(pagesDeploy, /cache:\s*npm/)
})
