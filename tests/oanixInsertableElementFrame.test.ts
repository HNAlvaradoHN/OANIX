import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('src/features/editor/implementations/OanixInsertableElementFrame.tsx', 'utf8')
const styles = readFileSync('src/features/editor/implementations/oanixInsertableElementFrame.css', 'utf8')

test('insertable element frame supports the seven agreed element identities', () => {
  for (const kind of ['entry', 'image', 'file', 'code', 'checklist', 'contact', 'separator']) {
    assert.match(source, new RegExp(`'${kind}'`))
  }
})

test('context menu adapts to viewport and closes on outside, scroll and Escape', () => {
  assert.match(source, /visualViewport\?\.height/)
  assert.match(source, /spaceBelow < 220 && spaceAbove > spaceBelow/)
  assert.match(source, /addEventListener\('pointerdown'/)
  assert.match(source, /addEventListener\('scroll', onScroll, true\)/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(styles, /data-direction="down"/)
  assert.match(styles, /data-direction="up"/)
  assert.match(styles, /max-height: min\(320px, calc\(100dvh - 32px\)\)/)
  assert.match(styles, /overscroll-behavior: contain/)
})

test('expanded preview is bounded and universally dismissible on web surfaces', () => {
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /event\.target === event\.currentTarget/)
  assert.match(source, /aria-label="Cerrar"/)
  assert.match(styles, /max-height: min\(82dvh, 900px\)/)
  assert.match(styles, /@media \(max-width: 640px\)/)
  assert.match(styles, /max-height: 88dvh/)
})

test('frame remains a presentation layer without direct persistence or security access', () => {
  assert.doesNotMatch(source, /from ['"][^'"]*(?:attachmentService|contentCrypto|vault|storage)[^'"]*['"]/)
  assert.doesNotMatch(source, /\blocalStorage\b|\bindexedDB\b|\bonRequestSave\b/)
})
