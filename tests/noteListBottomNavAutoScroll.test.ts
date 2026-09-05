import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/rebuild/NoteListSection.tsx', 'utf8')

test('note drag lower autoscroll uses the visible edge above the fixed bottom nav', () => {
  assert.match(source, /function autoScrollBounds\(container: HTMLElement\)/)
  assert.match(source, /document\.querySelector<HTMLElement>\('\.rebuild-bottom-nav'\)/)
  assert.match(source, /Math\.min\(rect\.bottom, bottomNav\.getBoundingClientRect\(\)\.top\)/)
  assert.match(source, /autoScrollTargetVelocity\(pointer\.y, autoScrollBounds\(container\)\)/)
})
