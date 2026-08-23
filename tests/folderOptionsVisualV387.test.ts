import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync('src/main.tsx', 'utf8')
const runtime = readFileSync('src/features/notes/WorkspacePersonalizationRuntime.tsx', 'utf8')
const css = readFileSync('src/features/notes/folderOptionsVisual.css', 'utf8')

test('folder options keeps the approved v38.7 action order', () => {
  const actionsStart = runtime.indexOf('className="oanix-folder-options__actions"')
  const actionsEnd = runtime.indexOf('</section>', actionsStart)
  assert.ok(actionsStart >= 0 && actionsEnd > actionsStart, 'folder options action markup must exist')
  const folderActions = runtime.slice(actionsStart, actionsEnd)

  const labels = [
    'Abrir carpeta',
    'Fijar carpeta',
    'Marcar como favorito',
    'Renombrar carpeta',
    'Cambiar color / Icono',
    'Cambiar imagen local',
    'Eliminar carpeta',
    'Cancelar',
  ]

  let previous = -1
  for (const label of labels) {
    const index = folderActions.indexOf(label)
    assert.ok(index > previous, `${label} must stay in the approved order`)
    previous = index
  }
})

test('folder options copies the v38.7 modal geometry instead of the compact legacy layout', () => {
  assert.match(css, /max-width: 380px !important/)
  assert.match(css, /padding: 24px !important/)
  assert.match(css, /border-radius: 28px !important/)
  assert.match(css, /box-shadow: 0 25px 50px rgba\(0, 0, 0, 0\.25\) !important/)
  assert.match(css, /\.oanix-folder-options h3[\s\S]*font-size: 20px !important[\s\S]*text-align: center !important/)
  assert.match(css, /\.oanix-folder-options__actions[\s\S]*gap: 16px !important/)
  assert.match(css, /\.oanix-folder-options__actions button[\s\S]*min-height: 0 !important[\s\S]*padding: 12px 16px !important[\s\S]*gap: 10px !important[\s\S]*border-radius: 16px !important[\s\S]*font-size: 13px !important/)
  assert.doesNotMatch(css, /min-height:\s*(?:60|64)px/)
})

test('folder options visual contract loads before the final workspace contract', () => {
  const modalIndex = main.indexOf("./features/notes/folderOptionsVisual.css")
  const workspaceIndex = main.indexOf("./features/notes/v383WorkspaceVisual.css")
  assert.ok(modalIndex >= 0 && workspaceIndex > modalIndex)
})
