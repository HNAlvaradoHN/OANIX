import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('src/features/folders/folderGrid.css', 'utf8')

test('folder mobile media query closes before desktop and shared styles continue', () => {
  const mobileStart = css.indexOf('@media (max-width: 768px)')
  const narrowStart = css.indexOf('@media (max-width: 390px)', mobileStart)
  const desktopStart = css.indexOf('@media (max-height: 650px) and (min-width: 769px)', narrowStart)

  assert.ok(mobileStart >= 0, 'missing mobile folder media query')
  assert.ok(narrowStart > mobileStart, 'missing narrow mobile media query')
  assert.ok(desktopStart > narrowStart, 'missing desktop compact-height media query')

  const betweenNarrowAndDesktop = css.slice(narrowStart, desktopStart)
  assert.match(
    betweenNarrowAndDesktop,
    /\.oanix-folder-rail__item > small \{ top: 43px; \}\s*\}\s*\}/,
    'the 390px block and the enclosing 768px block must both close before desktop rules',
  )

  assert.equal(
    (css.match(/\{/g) ?? []).length,
    (css.match(/\}/g) ?? []).length,
    'folderGrid.css must keep balanced braces so later CSS imports cannot leak into a mobile media query',
  )
})
