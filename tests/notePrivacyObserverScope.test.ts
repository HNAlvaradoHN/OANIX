import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const privacyRuntime = readFileSync('src/features/privacy/NotePrivacyRuntime.tsx', 'utf8')

test('note privacy filters workspace mutations before bumping DOM revision', () => {
  assert.match(privacyRuntime, /querySelector<HTMLElement>\('\.notes-shell'\)/)
  assert.match(privacyRuntime, /function mutationTouchesPrivacySurface\(record: MutationRecord\)/)
  assert.match(privacyRuntime, /records\.some\(mutationTouchesPrivacySurface\)/)
  assert.match(privacyRuntime, /attributeFilter: \['class', 'aria-expanded'\]/)
  assert.match(privacyRuntime, /attributeOldValue: true/)
  assert.doesNotMatch(privacyRuntime, /new MutationObserver\(bump\)/)
  assert.doesNotMatch(privacyRuntime, /observer\.observe\(document\.body/)
  assert.doesNotMatch(privacyRuntime, /observer\.observe\(document\.documentElement/)
})

test('note privacy only bumps on search input instead of every workspace input', () => {
  assert.match(privacyRuntime, /const onInput = \(event: Event\) =>/)
  assert.match(privacyRuntime, /target\.matches\('\.notes-search input\[type="search"\]'\)/)
  assert.match(privacyRuntime, /window\.addEventListener\('input', onInput, true\)/)
  assert.match(privacyRuntime, /window\.removeEventListener\('input', onInput, true\)/)
  assert.doesNotMatch(privacyRuntime, /window\.addEventListener\('input', bump, true\)/)
})

test('note privacy mutation filter covers only privacy-relevant surfaces', () => {
  for (const selector of [
    '.note-row',
    '.note-row__menu',
    '.note-view',
    '.note-view__menu',
    '.workspace-menu',
    '.note-canvas',
    '.notes-search',
  ]) {
    assert.ok(privacyRuntime.includes(selector), `missing ${selector} from privacy surface contract`)
  }
})
