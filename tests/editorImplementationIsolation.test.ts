import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const implementationsDir = 'src/features/editor/implementations'
const implementationFiles = readdirSync(implementationsDir)
  .filter((name) => /\.(?:ts|tsx)$/.test(name))
  .map((name) => join(implementationsDir, name))

const forbiddenImport = /(?:rebuild|vault|repository|persistence|sync|storage|crypto|indexeddb)/i
const browserStorage = /\b(?:indexedDB|localStorage|sessionStorage)\b/

test('editor implementations stay visual and do not import OANIX data/security layers', () => {
  assert.ok(implementationFiles.length > 0, 'expected at least one editor implementation')

  for (const path of implementationFiles) {
    const source = readFileSync(path, 'utf8')
    const imports = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line))
      .join('\n')

    assert.doesNotMatch(
      imports,
      forbiddenImport,
      `${path} must receive data/actions through EditorSurfaceProps instead of importing app layers`,
    )
    assert.doesNotMatch(
      source,
      browserStorage,
      `${path} must not create parallel browser persistence`,
    )
  }
})

test('the active surface registry remains a composition-only module', () => {
  const registry = readFileSync('src/features/editor/editorSurfaceRegistry.ts', 'utf8')
  const imports = registry
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line))
    .join('\n')

  assert.doesNotMatch(registry, browserStorage)
  assert.doesNotMatch(imports, /(?:rebuild|vault|repository|persistence|sync|storage|crypto|indexeddb)/i)
})
