import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { responsiveLayoutForWidth, usesSinglePaneLayout } from '../src/shared/responsiveLayout.ts'

test('classifies mobile tablet and desktop widths explicitly', () => {
  assert.equal(responsiveLayoutForWidth(360), 'mobile')
  assert.equal(responsiveLayoutForWidth(760), 'mobile')
  assert.equal(responsiveLayoutForWidth(761), 'tablet')
  assert.equal(responsiveLayoutForWidth(1024), 'tablet')
  assert.equal(responsiveLayoutForWidth(1100), 'tablet')
  assert.equal(responsiveLayoutForWidth(1101), 'desktop')
  assert.equal(responsiveLayoutForWidth(1440), 'desktop')
})

test('only mobile uses the single-pane note navigation model', () => {
  assert.equal(usesSinglePaneLayout(412), true)
  assert.equal(usesSinglePaneLayout(800), false)
  assert.equal(usesSinglePaneLayout(1366), false)
})

test('mobile vault access stays ahead of the decorative landing content and within the viewport', () => {
  const css = readFileSync('src/styles/global.css', 'utf8')
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.vault-card\s*\{[\s\S]*?order:\s*-1;/)
  assert.match(css, /\.vault-card\s*\{[\s\S]*?position:\s*sticky;/)
  assert.match(css, /\.vault-card__body\s*\{[\s\S]*?overflow-y:\s*auto;/)
})

test('heavy headings reserve vertical space for descenders across browsers', () => {
  const css = readFileSync('src/styles/global.css', 'utf8')

  assert.match(css, /Cross-device typography safety/)
  assert.match(css, /\.vault-title\s*\{[\s\S]*?line-height:\s*\.98;[\s\S]*?padding-bottom:\s*\.08em;/)
  assert.match(css, /\.notes-brand strong,[\s\S]*?\.note-row__topline strong\s*\{[\s\S]*?line-height:\s*1\.28;[\s\S]*?padding-bottom:\s*\.06em;/)
  assert.match(css, /\.note-title-field input\s*\{[\s\S]*?line-height:\s*1\.14 !important;[\s\S]*?padding-block:\s*\.06em \.16em !important;/)
})
