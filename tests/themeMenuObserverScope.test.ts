import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/personalization/ThemeMenu.tsx', 'utf8')

test('ThemeMenu binds when the notes workspace appears after unlock', () => {
  assert.match(source, /const WORKSPACE_SELECTOR = '\.notes-shell'/)
  assert.match(source, /const WORKSPACE_MENU_SELECTOR = '\.workspace-menu\[role="menu"\]'/)
  assert.match(source, /const appRoot = document\.getElementById\('root'\)/)
  assert.match(source, /function bindWorkspace\(\)/)
  assert.match(source, /document\.querySelector<HTMLElement>\(WORKSPACE_SELECTOR\)/)
  assert.match(source, /workspaceHostObserver\.observe\(appRoot, \{ childList: true, subtree: true \}\)/)
  assert.match(source, /mutationTouchesSelector\(record, WORKSPACE_SELECTOR\)/)
})

test('ThemeMenu filters workspace mutations down to menu mount changes', () => {
  assert.match(source, /workspace\?\.querySelector<HTMLElement>\(WORKSPACE_MENU_SELECTOR\)/)
  assert.match(source, /workspaceMenuObserver = new MutationObserver\(\(records\) =>/)
  assert.match(source, /mutationTouchesSelector\(record, WORKSPACE_MENU_SELECTOR\)/)
  assert.match(source, /workspaceMenuObserver\.observe\(workspace, \{ childList: true, subtree: true \}\)/)
  assert.doesNotMatch(source, /new MutationObserver\(syncWorkspaceMenu\)/)
  assert.doesNotMatch(source, /observe\(document\.body/)
})

test('ThemeMenu installs global dismiss listeners only while the security panel is open', () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*if \(!open\) return[\s\S]*window\.addEventListener\('pointerdown', handlePointerDown\)[\s\S]*window\.addEventListener\('keydown', handleKeyDown\)[\s\S]*\}, \[open\]\)/,
  )
})
