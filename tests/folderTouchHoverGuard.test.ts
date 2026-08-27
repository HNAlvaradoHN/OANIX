import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('src/features/folders/folderInteractive.css', 'utf8')

test('touch folder interactions neutralize latched hover transforms', () => {
  const start = css.indexOf('@media (hover: none), (pointer: coarse)')
  assert.ok(start >= 0)
  const block = css.slice(start)

  assert.match(block, /html\.oanix-v383-visual \.oanix-folder-rail__item:hover:not\(\.is-selected\)[\s\S]*transform: none !important/)
  assert.match(block, /html\.oanix-v383-visual \.oanix-folder-rail__item\.is-selected:hover[\s\S]*transform: translateY\(-1px\) !important/)
  assert.match(block, /\.oanix-folder-customizer button:hover:not\(:focus-visible\)[\s\S]*transform: none/)
  assert.match(block, /\.oanix-folder-appearance-picker__icon:hover:not\(:focus-visible\)[\s\S]*transform: none/)
})
