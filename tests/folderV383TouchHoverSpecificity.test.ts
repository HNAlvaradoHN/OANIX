import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const v383 = readFileSync('src/features/notes/v383WorkspaceVisual.css', 'utf8')
const guard = readFileSync('src/features/folders/folderTouchHoverSpecificity.css', 'utf8')

test('v383 folder hover transform cannot win on coarse pointers', () => {
  assert.match(main, /import '\.\/features\/folders\/folderTouchHoverSpecificity\.css'/)
  assert.match(v383, /html\.oanix-v383-visual \.oanix-folder-rail__item:hover\s*\{[^}]*transform:\s*translateY\(-2px\)\s*!important;/)
  assert.match(guard, /html\.oanix-v383-visual \.oanix-folder-rail__item:hover:not\(\.is-selected\)\s*\{[^}]*transform:\s*none\s*!important;/)
  assert.match(guard, /html\.oanix-v383-visual \.oanix-folder-rail__item\.is-selected:hover\s*\{[^}]*transform:\s*translateY\(-1px\)\s*!important;/)
})
