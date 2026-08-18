import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const classicDay = readFileSync('src/styles/classic-day-hard-fix.css', 'utf8')

test('Classic Day keeps a dark high-contrast OANIX nucleus on light surfaces', () => {
  assert.match(classicDay, /html\.oanix-classic-day \.notes-brand__mark/)
  assert.match(classicDay, /radial-gradient\(circle, #1f4f91 0 34%, #0f2a4f 58%, #08162b 100%\)/)
  assert.match(classicDay, /color: #ffffff !important/)
  assert.match(classicDay, /border-color: rgba\(37,99,235,\.72\) !important/)
  assert.match(classicDay, /\.notes-brand__mark::before/)
  assert.match(classicDay, /\.notes-brand__mark::after/)
})
