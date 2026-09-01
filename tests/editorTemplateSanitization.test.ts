import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const implementationsDir = 'src/features/editor/implementations'
const sourceExtensions = /\.(?:ts|tsx|js|mjs|css|html)$/i

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return collectSourceFiles(path)
    return sourceExtensions.test(name) ? [path] : []
  })
}

const sourceFiles = collectSourceFiles(implementationsDir)

const parallelPersistence = /\b(?:indexedDB|localStorage|sessionStorage)\b/
const remotePrototypeDependency = /(?:image\.qwenlm\.ai|unpkg\.com|cdn\.jsdelivr\.net)/i
const prototypeOnlyState = /(?:Nota eliminada \(demo\)|aurora-boreal\.jpg|Proyectos \/ Aurora)/i

test('editor implementation sources do not carry prototype persistence or remote demo dependencies', () => {
  assert.ok(sourceFiles.length > 0, 'expected at least one editor implementation source')

  for (const path of sourceFiles) {
    const source = readFileSync(path, 'utf8')

    assert.doesNotMatch(
      source,
      parallelPersistence,
      `${path} must delegate persistence to the EditorSurface contract`,
    )
    assert.doesNotMatch(
      source,
      remotePrototypeDependency,
      `${path} must not depend on Qwen demo assets or runtime CDN resources`,
    )
    assert.doesNotMatch(
      source,
      prototypeOnlyState,
      `${path} must not ship the selected template's demo content/state`,
    )
  }
})

test('a future raw template intake cannot silently introduce a second runtime authority', () => {
  for (const path of sourceFiles.filter((path) => path.endsWith('.html'))) {
    const source = readFileSync(path, 'utf8')
    const inlineExecutableScripts = [...source.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((match) => match[1].trim())
      .filter(Boolean)
    const externalScripts = [...source.matchAll(/<script[^>]*\bsrc=["'][^"']+["'][^>]*>/gi)]

    assert.ok(
      inlineExecutableScripts.length + externalScripts.length <= 1,
      `${path} must have one runtime JavaScript authority after sanitation`,
    )
  }
})
