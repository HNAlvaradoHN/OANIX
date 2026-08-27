import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('src/features/tags/tagCreation.css', 'utf8')

test('tag picker hover transforms only run on fine hover pointers', () => {
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/)
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*\.oanix-tag-create__icons button:hover[\s\S]*transform: translateY\(-1px\)/)
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*\.oanix-tag-create__colors button:hover[\s\S]*transform: scale\(1\.05\)/)
  assert.match(css, /\.oanix-tag-create__icons button:focus-visible[\s\S]*transform: translateY\(-1px\)/)
  assert.match(css, /\.oanix-tag-create__colors button:focus-visible[\s\S]*transform: scale\(1\.05\)/)
  assert.doesNotMatch(css, /\.oanix-tag-create__icons button:hover,\s*\n\.oanix-tag-create__icons button:focus-visible/)
  assert.doesNotMatch(css, /\.oanix-tag-create__colors button:hover,\s*\n\.oanix-tag-create__colors button:focus-visible/)
})
