import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

function collectCssFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      files.push(...collectCssFiles(path))
    } else if (entry.endsWith('.css')) {
      files.push(path)
    }
  }
  return files
}

function assertBalancedCssBraces(source: string, file: string) {
  let depth = 0
  let quote: "'" | '"' | null = null
  let inComment = false
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]
    const next = source[index + 1]

    if (inComment) {
      if (current === '*' && next === '/') {
        inComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (current === '\\') {
        escaped = true
        continue
      }
      if (current === quote) quote = null
      continue
    }

    if (current === '/' && next === '*') {
      inComment = true
      index += 1
      continue
    }

    if (current === "'" || current === '"') {
      quote = current
      continue
    }

    if (current === '{') depth += 1
    if (current === '}') depth -= 1

    assert.ok(depth >= 0, `${file} closes a CSS block before it was opened`)
  }

  assert.equal(depth, 0, `${file} has an unclosed CSS block`)
  assert.equal(inComment, false, `${file} has an unclosed CSS comment`)
  assert.equal(quote, null, `${file} has an unclosed CSS string`)
}

test('all source CSS files keep structurally balanced blocks', () => {
  const files = collectCssFiles('src')
  assert.ok(files.length > 0, 'expected CSS source files')

  for (const file of files) {
    assertBalancedCssBraces(readFileSync(file, 'utf8'), relative('.', file))
  }
})
