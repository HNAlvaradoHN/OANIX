import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const runtime = readFileSync('src/features/folders/FolderTiltRuntime.tsx', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const gate = readFileSync('src/app/WorkspaceRuntimeGate.tsx', 'utf8')

test('el panel de carpeta sigue la posición real del mouse con tilt 3D limitado', () => {
  assert.match(runtime, /\.oanix-folder-focus__details/)
  assert.match(runtime, /pointermove/)
  assert.match(runtime, /getBoundingClientRect\(\)/)
  assert.match(runtime, /event\.clientX/)
  assert.match(runtime, /event\.clientY/)
  assert.match(runtime, /MAX_ROTATE_X = 3\.2/)
  assert.match(runtime, /MAX_ROTATE_Y = 4\.8/)
  assert.match(runtime, /rotateX\(/)
  assert.match(runtime, /rotateY\(/)
  assert.match(runtime, /requestAnimationFrame/)
})

test('el tilt respeta accesibilidad, mouse fino y se limpia al salir', () => {
  assert.match(runtime, /\(hover: hover\) and \(pointer: fine\)/)
  assert.match(runtime, /prefers-reduced-motion: reduce/)
  assert.match(runtime, /event\.pointerType !== 'mouse'/)
  assert.match(runtime, /pointerout/)
  assert.match(runtime, /removeProperty\('transform'\)/)
  assert.match(runtime, /cancelAnimationFrame/)
})

test('el runtime de tilt se monta con el workspace desbloqueado sin entrar en navegación ni servicios', () => {
  assert.match(main, /<WorkspaceRuntimeGate \/>/)
  assert.match(gate, /import \{ FolderTiltRuntime \} from '\.\.\/features\/folders\/FolderTiltRuntime'/)
  assert.match(gate, /<FolderTiltRuntime \/>/)
})
