from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected marker not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if marker in text:
        return
    p.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


# ---------------------------------------------------------------------------
# 1. Global OANIX menu: lock remains a single, visible top-level action.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    '''                <div className="workspace-menu" role="menu" aria-label="Acciones de OANIX">\n                  <button type="button" role="menuitem" onClick={() => void handleLockWorkspace()}>\n                    <span aria-hidden="true">🔒</span> Bloquear OANIX\n                  </button>\n                  <button\n''',
    '''                <div className="workspace-menu" role="menu" aria-label="Acciones de OANIX">\n                  <button\n''',
)


# ---------------------------------------------------------------------------
# 2. Shared visual-viewport geometry for keyboard-safe overlays.
# ---------------------------------------------------------------------------
viewport_path = Path('src/shared/viewportMetrics.ts')
viewport_path.parent.mkdir(parents=True, exist_ok=True)
viewport_path.write_text('''export interface ViewportMetricsInput {\n  layoutHeight: number\n  visualHeight: number\n  visualOffsetTop: number\n}\n\n/**\n * Returns the portion of the layout viewport currently obscured below the\n * visual viewport (typically the on-screen keyboard). Browsers that resize\n * the layout viewport naturally return zero, so the same rule works across\n * desktop, tablets and different mobile keyboard behaviours.\n */\nexport function keyboardInsetFromViewport({\n  layoutHeight,\n  visualHeight,\n  visualOffsetTop,\n}: ViewportMetricsInput): number {\n  if (![layoutHeight, visualHeight, visualOffsetTop].every(Number.isFinite)) return 0\n  return Math.max(0, Math.round(layoutHeight - visualHeight - visualOffsetTop))\n}\n''', encoding='utf-8')

# Import helper.
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    "import { CodeBlockEditor } from '../editor/CodeBlockEditor'\n",
    "import { CodeBlockEditor } from '../editor/CodeBlockEditor'\nimport { keyboardInsetFromViewport } from '../../shared/viewportMetrics'\n",
)

# Make close action visually/semantically explicit.
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''function setImageInfoOpen(figure: HTMLElement, open: boolean): void {\n  figure.dataset.imageInfoOpen = String(open)\n  const button = figure.querySelector<HTMLButtonElement>('[data-image-info="true"]')\n  if (button) {\n    button.textContent = open ? '−' : '+'\n    button.setAttribute('aria-expanded', String(open))\n    button.title = open ? 'Ocultar información' : 'Mostrar información y descripción'\n  }\n}\n''',
    '''function setImageInfoOpen(figure: HTMLElement, open: boolean): void {\n  figure.dataset.imageInfoOpen = String(open)\n  const button = figure.querySelector<HTMLButtonElement>('[data-image-info="true"]')\n  if (button) {\n    button.textContent = open ? '×' : '+'\n    button.setAttribute('aria-expanded', String(open))\n    button.title = open ? 'Cerrar opciones de imagen' : 'Mostrar información y descripción'\n    button.setAttribute(\n      'aria-label',\n      open ? 'Cerrar opciones de imagen' : 'Mostrar información y descripción de la imagen',\n    )\n  }\n}\n''',
)

# Keep editor dock/panels attached to the visible viewport, above software keyboards.
replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''    const root: HTMLDivElement = currentRoot\n    let resizeState: ResizeState | null = null\n\n    decorateToolbar(root)\n''',
    '''    const root: HTMLDivElement = currentRoot\n    let resizeState: ResizeState | null = null\n\n    function syncVisualViewportMetrics() {\n      const visualViewport = window.visualViewport\n      const visualHeight = visualViewport?.height ?? window.innerHeight\n      const inset = keyboardInsetFromViewport({\n        layoutHeight: window.innerHeight,\n        visualHeight,\n        visualOffsetTop: visualViewport?.offsetTop ?? 0,\n      })\n\n      root.style.setProperty('--oanix-keyboard-inset', `${inset}px`)\n      root.style.setProperty('--oanix-visual-height', `${Math.max(1, Math.round(visualHeight))}px`)\n    }\n\n    syncVisualViewportMetrics()\n    window.visualViewport?.addEventListener('resize', syncVisualViewportMetrics)\n    window.visualViewport?.addEventListener('scroll', syncVisualViewportMetrics)\n    window.addEventListener('resize', syncVisualViewportMetrics)\n\n    decorateToolbar(root)\n''',
)

replace_once(
    'src/features/images/ImageNoteEditor.tsx',
    '''      document.removeEventListener('pointercancel', handlePointerUp, true)\n      document.removeEventListener('keydown', handleKeyDown)\n\n      const urls = new Set([...objectUrlsRef.current.values(), ...previewUrlsRef.current.values()])\n''',
    '''      document.removeEventListener('pointercancel', handlePointerUp, true)\n      document.removeEventListener('keydown', handleKeyDown)\n      window.visualViewport?.removeEventListener('resize', syncVisualViewportMetrics)\n      window.visualViewport?.removeEventListener('scroll', syncVisualViewportMetrics)\n      window.removeEventListener('resize', syncVisualViewportMetrics)\n\n      const urls = new Set([...objectUrlsRef.current.values(), ...previewUrlsRef.current.values()])\n''',
)


# ---------------------------------------------------------------------------
# 3. Code menu: never clip inside the code card; adapt direction/placement.
# ---------------------------------------------------------------------------
code = Path('src/features/editor/CodeBlockEditor.tsx')
text = code.read_text(encoding='utf-8')

old = '''    function handleClick(event: MouseEvent) {\n      const target = event.target\n      if (!(target instanceof Element)) return\n\n      const actionToggle = target.closest<HTMLButtonElement>('[data-code-actions-toggle="true"]')\n'''
new = '''    function closeCodeActionMenus() {\n      root.querySelectorAll<HTMLElement>('[data-code-actions-menu="true"]').forEach((candidate) => {\n        candidate.hidden = true\n      })\n      root.querySelectorAll<HTMLButtonElement>('[data-code-actions-toggle="true"]').forEach((candidate) => {\n        candidate.setAttribute('aria-expanded', 'false')\n      })\n      root.querySelectorAll<HTMLElement>('[data-code-block="true"]').forEach((block) => {\n        delete block.dataset.codeMenuOpen\n        delete block.dataset.codeMenuDirection\n      })\n    }\n\n    function handleClick(event: MouseEvent) {\n      const target = event.target\n      if (!(target instanceof Element)) return\n\n      const actionToggle = target.closest<HTMLButtonElement>('[data-code-actions-toggle="true"]')\n'''
if old not in text:
    raise SystemExit('Code menu handleClick marker not found')
text = text.replace(old, new, 1)

old = '''        const toolbar = actionToggle.closest<HTMLElement>('.editor-code-block__toolbar')\n        const menu = toolbar?.querySelector<HTMLElement>('[data-code-actions-menu="true"]')\n        if (!menu) return\n        const opening = menu.hidden\n        root.querySelectorAll<HTMLElement>('[data-code-actions-menu="true"]').forEach((candidate) => { candidate.hidden = true })\n        root.querySelectorAll<HTMLButtonElement>('[data-code-actions-toggle="true"]').forEach((candidate) => candidate.setAttribute('aria-expanded', 'false'))\n        menu.hidden = !opening\n        actionToggle.setAttribute('aria-expanded', String(opening))\n        return\n'''
new = '''        const toolbar = actionToggle.closest<HTMLElement>('.editor-code-block__toolbar')\n        const block = actionToggle.closest<HTMLElement>('[data-code-block="true"]')\n        const menu = toolbar?.querySelector<HTMLElement>('[data-code-actions-menu="true"]')\n        if (!menu || !block) return\n        const opening = menu.hidden\n        closeCodeActionMenus()\n\n        if (opening) {\n          const viewport = window.visualViewport\n          const visibleTop = viewport?.offsetTop ?? 0\n          const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight)\n          const toggleRect = actionToggle.getBoundingClientRect()\n          const estimatedMenuHeight = 150\n          const spaceBelow = visibleBottom - toggleRect.bottom\n          const spaceAbove = toggleRect.top - visibleTop\n\n          block.dataset.codeMenuOpen = 'true'\n          block.dataset.codeMenuDirection =\n            spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'up' : 'down'\n          menu.hidden = false\n          actionToggle.setAttribute('aria-expanded', 'true')\n        }\n        return\n'''
if old not in text:
    raise SystemExit('Code menu toggle implementation marker not found')
text = text.replace(old, new, 1)

old = '''      const clickedCodeAction = target.closest('[data-code-copy="true"], [data-code-convert="true"], [data-code-delete="true"], [data-code-expand="true"]')\n      if (clickedCodeAction) {\n        const toolbar = clickedCodeAction.closest<HTMLElement>('.editor-code-block__toolbar')\n        const menu = toolbar?.querySelector<HTMLElement>('[data-code-actions-menu="true"]')\n        const toggle = toolbar?.querySelector<HTMLButtonElement>('[data-code-actions-toggle="true"]')\n        if (menu) menu.hidden = true\n        toggle?.setAttribute('aria-expanded', 'false')\n      }\n'''
new = '''      const clickedCodeAction = target.closest('[data-code-copy="true"], [data-code-convert="true"], [data-code-delete="true"], [data-code-expand="true"]')\n      if (clickedCodeAction) closeCodeActionMenus()\n      else if (!target.closest('[data-code-actions-menu="true"]')) closeCodeActionMenus()\n'''
if old not in text:
    raise SystemExit('Code action close marker not found')
text = text.replace(old, new, 1)

old = '''    function handleKeyDown(event: KeyboardEvent) {\n      if (event.key !== 'Escape') return\n\n      if (activeFullscreenDialog) {\n'''
new = '''    function handleKeyDown(event: KeyboardEvent) {\n      if (event.key !== 'Escape') return\n\n      closeCodeActionMenus()\n\n      if (activeFullscreenDialog) {\n'''
if old not in text:
    raise SystemExit('Code Escape marker not found')
text = text.replace(old, new, 1)

# Close if pointer lands elsewhere in the document (including outside editor root).
old = '''    root.addEventListener('click', handleClick, true)\n    document.addEventListener('keydown', handleKeyDown)\n'''
new = '''    function handleDocumentPointerDown(event: PointerEvent) {\n      const target = event.target\n      if (target instanceof Element && target.closest('[data-code-actions-toggle="true"], [data-code-actions-menu="true"]')) return\n      closeCodeActionMenus()\n    }\n\n    root.addEventListener('click', handleClick, true)\n    document.addEventListener('pointerdown', handleDocumentPointerDown)\n    document.addEventListener('keydown', handleKeyDown)\n'''
if old not in text:
    raise SystemExit('Code listener marker not found')
text = text.replace(old, new, 1)

old = '''      observer.disconnect()\n      root.removeEventListener('click', handleClick, true)\n      document.removeEventListener('keydown', handleKeyDown)\n'''
new = '''      observer.disconnect()\n      root.removeEventListener('click', handleClick, true)\n      document.removeEventListener('pointerdown', handleDocumentPointerDown)\n      document.removeEventListener('keydown', handleKeyDown)\n'''
if old not in text:
    raise SystemExit('Code cleanup marker not found')
text = text.replace(old, new, 1)
code.write_text(text, encoding='utf-8')


# ---------------------------------------------------------------------------
# 4. Responsive CSS: visible viewport drives dock/sheets; menus never clip.
# ---------------------------------------------------------------------------
append_once(
    'src/features/images/images.css',
    '/* OANIX visible-viewport responsive overlays v3 */',
    '''/* OANIX visible-viewport responsive overlays v3 */\n.image-note-editor-root {\n  --oanix-keyboard-inset: 0px;\n  --oanix-visual-height: 100dvh;\n}\n\n.mobile-editor-dock {\n  bottom: calc(max(.7rem, env(safe-area-inset-bottom)) + var(--oanix-keyboard-inset, 0px)) !important;\n  transition: bottom 120ms ease;\n}\n\n.editor-command-panel {\n  bottom: calc(4.45rem + env(safe-area-inset-bottom) + var(--oanix-keyboard-inset, 0px)) !important;\n  max-height: min(62dvh, calc(var(--oanix-visual-height, 100dvh) - 6rem));\n}\n\n.image-note-editor-root .editor-image-block[data-image-info-open='true'] .editor-image-block__info {\n  min-width: 2.55rem !important;\n  width: 2.55rem !important;\n  min-height: 2.55rem !important;\n  height: 2.55rem !important;\n  padding: 0 !important;\n  display: grid !important;\n  place-items: center;\n  border-color: #cbd5e1 !important;\n  background: #f8fafc !important;\n  color: #334155 !important;\n  font-size: 1.4rem !important;\n  line-height: 1 !important;\n}\n\n@container (max-width: 34rem) {\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__footer {\n    bottom: calc(4.65rem + env(safe-area-inset-bottom) + var(--oanix-keyboard-inset, 0px)) !important;\n    max-height: min(58dvh, calc(var(--oanix-visual-height, 100dvh) - 6.25rem));\n    overflow-y: auto;\n    padding-top: 3.7rem !important;\n  }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__info {\n    position: absolute;\n    z-index: 2;\n    top: .6rem;\n    right: .65rem;\n  }\n\n  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__actions {\n    padding-right: 0;\n  }\n}\n''',
)

append_once(
    'src/features/editor/codeBlockEditor.css',
    '/* OANIX adaptive unclipped code menu v3 */',
    '''/* OANIX adaptive unclipped code menu v3 */\n.code-block-editor-root .editor-code-block[data-code-menu-open='true'] {\n  position: relative;\n  z-index: 45;\n  overflow: visible !important;\n}\n\n.code-block-editor-root .editor-code-block[data-code-menu-direction='up'] .editor-code-block__actions-menu {\n  top: auto;\n  bottom: calc(100% + .35rem);\n}\n\n.code-block-editor-root .editor-code-block__actions-menu {\n  max-height: min(16rem, 46dvh);\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n\n@container (max-width: 34rem) {\n  .code-block-editor-root .editor-code-block__actions-menu,\n  .code-block-editor-root .editor-code-block[data-code-menu-direction='up'] .editor-code-block__actions-menu {\n    position: fixed !important;\n    z-index: 1800 !important;\n    top: auto !important;\n    right: max(.75rem, env(safe-area-inset-right)) !important;\n    bottom: calc(4.7rem + env(safe-area-inset-bottom) + var(--oanix-keyboard-inset, 0px)) !important;\n    left: max(.75rem, env(safe-area-inset-left)) !important;\n    width: auto !important;\n    max-height: min(44dvh, calc(var(--oanix-visual-height, 100dvh) - 6.5rem));\n    padding: .45rem;\n    overflow-y: auto;\n    border-radius: 1rem;\n    box-shadow: 0 20px 55px rgba(2,6,23,.5);\n  }\n\n  .code-block-editor-root .editor-code-block__actions-menu button {\n    min-height: 2.9rem !important;\n    padding-inline: .8rem !important;\n    font-size: .82rem !important;\n  }\n}\n''',
)


# ---------------------------------------------------------------------------
# 5. Tests and project rule documentation.
# ---------------------------------------------------------------------------
Path('tests/viewportMetrics.test.ts').write_text('''import assert from 'node:assert/strict'\nimport test from 'node:test'\n\nimport { keyboardInsetFromViewport } from '../src/shared/viewportMetrics.ts'\n\ntest('keyboard inset follows the visible viewport without assuming a device class', () => {\n  assert.equal(keyboardInsetFromViewport({ layoutHeight: 800, visualHeight: 500, visualOffsetTop: 0 }), 300)\n  assert.equal(keyboardInsetFromViewport({ layoutHeight: 800, visualHeight: 500, visualOffsetTop: 80 }), 220)\n  assert.equal(keyboardInsetFromViewport({ layoutHeight: 500, visualHeight: 500, visualOffsetTop: 0 }), 0)\n})\n\ntest('keyboard inset never becomes negative or NaN', () => {\n  assert.equal(keyboardInsetFromViewport({ layoutHeight: 500, visualHeight: 540, visualOffsetTop: 0 }), 0)\n  assert.equal(keyboardInsetFromViewport({ layoutHeight: Number.NaN, visualHeight: 500, visualOffsetTop: 0 }), 0)\n})\n''', encoding='utf-8')

append_once(
    'docs/ARCHITECTURE.md',
    '## Regla responsive de OANIX',
    '''## Regla responsive de OANIX\n\n- Cada cambio de interfaz se diseña como un único comportamiento para móvil, tablet y PC; no se mantienen versiones paralelas del mismo componente.\n- El contenedor y el viewport visible gobiernan el tamaño mediante `minmax`, `clamp`, flex/grid, wrapping y container queries.\n- Los breakpoints se reservan para cambios estructurales reales (por ejemplo, una o dos columnas), no para parchear modelos concretos de dispositivo.\n- Menús, overlays, imágenes, código y controles deben permanecer dentro del espacio visible y considerar teclado virtual, safe areas, zoom y textos largos.\n- Toda modificación visual debe revisarse en un rango continuo de anchos antes de considerarse cerrada.\n''',
)

append_once(
    'docs/CHANGELOG.md',
    '- Pulido responsive transversal: dock sobre teclado virtual, menús de código sin recortes, cierre explícito de opciones de imagen y eliminación de acciones duplicadas.',
    '''- Pulido responsive transversal: dock sobre teclado virtual, menús de código sin recortes, cierre explícito de opciones de imagen y eliminación de acciones duplicadas.\n''',
)
