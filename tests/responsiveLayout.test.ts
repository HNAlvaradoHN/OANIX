import assert from 'node:assert/strict'
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
