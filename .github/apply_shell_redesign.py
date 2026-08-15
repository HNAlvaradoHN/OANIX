from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if marker in text:
        return
    p.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


# ---------------------------------------------------------------------------
# 1. Persistence contract: mobile image sizes must remain valid note metadata.
# ---------------------------------------------------------------------------
replace_once(
    'src/features/notes/noteTypes.ts',
    '          block.widthPercent >= 35 &&\n          block.widthPercent <= 100)) &&',
    '          block.widthPercent >= 10 &&\n          block.widthPercent <= 100)) &&',
)

replace_once(
    'tests/imageBlocks.test.ts',
    "  const tooSmall = imageNote('image/png') as unknown as {\n    content: { blocks: Array<Record<string, unknown>> }\n  }\n  tooSmall.content.blocks[0].widthPercent = 20\n  assert.equal(isNoteRecord(tooSmall), false)\n",
    "  const compactMobile = imageNote('image/png')\n  const compactBlock = compactMobile.content.blocks[0]\n  if (compactBlock.type !== 'image') throw new Error('Expected image block')\n  compactBlock.widthPercent = 22\n  assert.equal(isNoteRecord(compactMobile), true, 'mobile image widths must survive persistence validation')\n\n  const tooSmall = imageNote('image/png') as unknown as {\n    content: { blocks: Array<Record<string, unknown>> }\n  }\n  tooSmall.content.blocks[0].widthPercent = 5\n  assert.equal(isNoteRecord(tooSmall), false)\n",
)

# ---------------------------------------------------------------------------
# 2. Fluid shell chrome: note actions, global menu and floating create button.
# ---------------------------------------------------------------------------
notes = Path('src/features/notes/NotesWorkspace.tsx')
text = notes.read_text(encoding='utf-8')

text = text.replace(
    "  const [noteMenuDirection, setNoteMenuDirection] = useState<'down' | 'up'>('down')\n",
    "  const [noteMenuDirection, setNoteMenuDirection] = useState<'down' | 'up'>('down')\n  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)\n  const [activeNoteMenuOpen, setActiveNoteMenuOpen] = useState(false)\n  const [noteInfoOpen, setNoteInfoOpen] = useState(false)\n",
    1,
)

text = text.replace(
    "      if (target instanceof Element && target.closest('[data-note-menu-root=\"true\"]')) return\n      setNoteMenuId(null)\n",
    "      if (target instanceof Element && target.closest('[data-note-menu-root=\"true\"]')) return\n      setNoteMenuId(null)\n      setWorkspaceMenuOpen(false)\n      setActiveNoteMenuOpen(false)\n",
    1,
)

text = text.replace(
    "      if (event.key === 'Escape') setNoteMenuId(null)\n",
    "      if (event.key === 'Escape') {\n        setNoteMenuId(null)\n        setWorkspaceMenuOpen(false)\n        setActiveNoteMenuOpen(false)\n        setNoteInfoOpen(false)\n      }\n",
    1,
)

text = text.replace(
    "    setNoteMenuId(null)\n    if (noteId === selectedId) return\n",
    "    setNoteMenuId(null)\n    setActiveNoteMenuOpen(false)\n    if (noteId === selectedId) return\n",
    1,
)

old_header_actions = '''          <div className="notes-header__actions">\n            <button\n              className="icon-button"\n              type="button"\n              onClick={() => void handleLockWorkspace()}\n              aria-label="Bloquear OANIX"\n              title="Bloquear OANIX"\n            >\n              ◼\n            </button>\n            <button\n              className="new-note-button"\n              type="button"\n              onClick={() => void handleCreateNote()}\n              disabled={creating}\n            >\n              <span aria-hidden="true">＋</span>\n              <span>{creating ? 'Creando…' : 'Nueva'}</span>\n            </button>\n          </div>\n'''
new_header_actions = '''          <div className="notes-header__actions" data-note-menu-root="true">\n            <button\n              className="icon-button"\n              type="button"\n              onClick={() => void handleLockWorkspace()}\n              aria-label="Bloquear OANIX"\n              title="Bloquear OANIX"\n            >\n              🔒\n            </button>\n            <div className="workspace-menu-wrap">\n              <button\n                className="icon-button"\n                type="button"\n                aria-label="Menú de OANIX"\n                aria-haspopup="menu"\n                aria-expanded={workspaceMenuOpen}\n                title="Menú de OANIX"\n                onClick={() => setWorkspaceMenuOpen((open) => !open)}\n              >\n                ⋮\n              </button>\n              {workspaceMenuOpen && (\n                <div className="workspace-menu" role="menu" aria-label="Acciones de OANIX">\n                  <button type="button" role="menuitem" onClick={() => void handleLockWorkspace()}>\n                    <span aria-hidden="true">🔒</span> Bloquear OANIX\n                  </button>\n                  <button\n                    type="button"\n                    role="menuitem"\n                    onClick={() => {\n                      setWorkspaceMenuOpen(false)\n                      window.alert('OANIX V1 · bóveda local cifrada · offline-first')\n                    }}\n                  >\n                    <span aria-hidden="true">ⓘ</span> Acerca de OANIX\n                  </button>\n                </div>\n              )}\n            </div>\n          </div>\n'''
if old_header_actions not in text:
    raise SystemExit('Notes header actions marker not found')
text = text.replace(old_header_actions, new_header_actions, 1)

# Floating create button lives in the same sidebar on every screen size.
list_close = '''        </div>\n      </aside>\n\n      <section className="note-view" aria-label="Nota abierta">\n'''
list_new = '''        </div>\n\n        <button\n          className="notes-create-fab"\n          type="button"\n          onClick={() => void handleCreateNote()}\n          disabled={creating}\n          aria-label={creating ? 'Creando nota' : 'Crear nueva nota'}\n          title="Nueva nota"\n        >\n          <span aria-hidden="true">＋</span>\n          <span>{creating ? 'Creando…' : 'Nueva nota'}</span>\n        </button>\n      </aside>\n\n      <section className="note-view" aria-label="Nota abierta">\n'''
if list_close not in text:
    raise SystemExit('Notes sidebar closing marker not found')
text = text.replace(list_close, list_new, 1)

old_note_header = '''            <header className="note-view__header">\n              <button\n                className="back-button"\n                type="button"\n                onClick={() => void handleBack()}\n                aria-label="Volver a la lista de notas"\n              >\n                ←\n              </button>\n              <div className="note-view__identity">\n                <span className="note-view__avatar" aria-hidden="true">{noteInitial(selectedNote.title)}</span>\n                <div>\n                  <strong>{selectedNote.title}</strong>\n                  <span className={saveState === 'error' ? 'save-status save-status--error' : 'save-status'}>\n                    {deletingSelected ? 'Eliminando nota…' : saveStateLabel(saveState, savingTitle)}\n                  </span>\n                </div>\n              </div>\n            </header>\n'''
new_note_header = '''            <header className="note-view__header">\n              <button\n                className="back-button"\n                type="button"\n                onClick={() => void handleBack()}\n                aria-label="Volver a la lista de notas"\n                title="Volver"\n              >\n                ←\n              </button>\n              <div className="note-view__identity">\n                <span className="note-view__avatar" aria-hidden="true">{noteInitial(selectedNote.title)}</span>\n                <div>\n                  <strong>{selectedNote.title}</strong>\n                  <span className={saveState === 'error' ? 'save-status save-status--error' : 'save-status'}>\n                    {deletingSelected ? 'Eliminando nota…' : saveStateLabel(saveState, savingTitle)}\n                  </span>\n                </div>\n              </div>\n              <div className="note-view__actions" data-note-menu-root="true">\n                <button\n                  className="note-view__menu-button"\n                  type="button"\n                  aria-label="Acciones de la nota"\n                  aria-haspopup="menu"\n                  aria-expanded={activeNoteMenuOpen}\n                  title="Acciones de la nota"\n                  onClick={() => setActiveNoteMenuOpen((open) => !open)}\n                >\n                  ⋮\n                </button>\n                {activeNoteMenuOpen && (\n                  <div className="note-view__menu" role="menu" aria-label="Acciones de la nota">\n                    <button\n                      type="button"\n                      role="menuitem"\n                      onClick={() => {\n                        setActiveNoteMenuOpen(false)\n                        setNoteInfoOpen(true)\n                      }}\n                    >\n                      <span aria-hidden="true">ⓘ</span> Información\n                    </button>\n                    <button\n                      className="note-view__menu-danger"\n                      type="button"\n                      role="menuitem"\n                      disabled={deletingId !== null}\n                      onClick={() => {\n                        setActiveNoteMenuOpen(false)\n                        void handleDeleteNote(selectedNote)\n                      }}\n                    >\n                      <span aria-hidden="true">🗑</span> {deletingSelected ? 'Eliminando…' : 'Eliminar nota'}\n                    </button>\n                  </div>\n                )}\n              </div>\n            </header>\n'''
if old_note_header not in text:
    raise SystemExit('Note header marker not found')
text = text.replace(old_note_header, new_note_header, 1)

# Add note info modal before section closes.
section_end = '''        )}\n      </section>\n    </main>\n  )\n}\n'''
section_new = '''        )}\n\n        {selectedNote && noteInfoOpen && (\n          <div className="note-info-dialog" role="presentation" onClick={() => setNoteInfoOpen(false)}>\n            <div\n              className="note-info-dialog__panel"\n              role="dialog"\n              aria-modal="true"\n              aria-label="Información de la nota"\n              onClick={(event) => event.stopPropagation()}\n            >\n              <div className="note-info-dialog__header">\n                <strong>Información de la nota</strong>\n                <button type="button" onClick={() => setNoteInfoOpen(false)} aria-label="Cerrar">×</button>\n              </div>\n              <dl>\n                <div><dt>Título</dt><dd>{selectedNote.title}</dd></div>\n                <div><dt>Creada</dt><dd>{new Date(selectedNote.createdAt).toLocaleString('es-HN')}</dd></div>\n                <div><dt>Modificada</dt><dd>{new Date(selectedNote.updatedAt).toLocaleString('es-HN')}</dd></div>\n                <div><dt>Bloques</dt><dd>{selectedNote.content.blocks.length}</dd></div>\n                <div><dt>Protección</dt><dd>Cifrada localmente</dd></div>\n              </dl>\n            </div>\n          </div>\n        )}\n      </section>\n    </main>\n  )\n}\n'''
if section_end not in text:
    raise SystemExit('Notes component end marker not found')
text = text.replace(section_end, section_new, 1)
notes.write_text(text, encoding='utf-8')

# ---------------------------------------------------------------------------
# 3. Editor dock: split Format (Aa) from Insert (+), same component everywhere.
# ---------------------------------------------------------------------------
images = Path('src/features/images/ImageNoteEditor.tsx')
text = images.read_text(encoding='utf-8')
text = text.replace(
    "  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)\n",
    "  const [activeDockPanel, setActiveDockPanel] = useState<'format' | 'insert' | null>(null)\n",
    1,
)

# Remove old auto-close hook based on hidden toolbar click.
text = text.replace(
    "      const selectedToolbarTool = target.closest<HTMLButtonElement>('.editor-toolbar button')\n      if (selectedToolbarTool && root.contains(selectedToolbarTool)) {\n        queueMicrotask(() => setMobileToolsOpen(false))\n      }\n\n",
    "",
    1,
)
text = text.replace("        setMobileToolsOpen(false)\n", "        setActiveDockPanel(null)\n", 1)

# Insert command helpers before closePreview.
marker = '''  function closePreview() {\n'''
helpers = '''  function keepEditorSelection(event: React.PointerEvent<HTMLButtonElement>) {\n    event.preventDefault()\n  }\n\n  function triggerToolbarAction(selector: string) {\n    const root = rootRef.current\n    const button = root?.querySelector<HTMLButtonElement>(`.editor-toolbar ${selector}`)\n    if (!button) return\n    button.click()\n    setActiveDockPanel(null)\n  }\n\n  function triggerImageInsert() {\n    const root = rootRef.current\n    if (!root) return\n    insertionAfterIdRef.current = currentDirectBlockId(root)\n    setActiveDockPanel(null)\n    inputRef.current?.click()\n  }\n\n  function handleDockUndo() {\n    const root = rootRef.current\n    if (root) undoLastChange(root)\n  }\n\n  function handleDockRedo() {\n    const root = rootRef.current\n    if (root) redoLastChange(root)\n  }\n\n'''
if marker not in text:
    raise SystemExit('Image editor helper marker not found')
text = text.replace(marker, helpers + marker, 1)

old_root = '''      className={`image-note-editor-root${mobileToolsOpen ? ' image-note-editor-root--mobile-tools-open' : ''}`}\n'''
new_root = '''      className={`image-note-editor-root${activeDockPanel ? ' image-note-editor-root--panel-open' : ''}`}\n'''
if old_root not in text:
    raise SystemExit('Image editor root class marker not found')
text = text.replace(old_root, new_root, 1)

old_dock = '''      <div className="mobile-editor-dock" role="toolbar" aria-label="Acciones rápidas del editor">\n        <button\n          className="mobile-editor-dock__history"\n          type="button"\n          data-undo-tool="true"\n          aria-label="Deshacer último cambio"\n          title="Deshacer"\n        >\n          ↶\n        </button>\n        <button\n          className="mobile-editor-dock__history"\n          type="button"\n          data-redo-tool="true"\n          aria-label="Rehacer último cambio"\n          title="Rehacer"\n        >\n          ↷\n        </button>\n        <button\n          className="mobile-editor-dock__tools"\n          type="button"\n          data-mobile-tools-toggle="true"\n          aria-label={mobileToolsOpen ? 'Cerrar herramientas de edición' : 'Abrir herramientas de edición'}\n          aria-expanded={mobileToolsOpen}\n          title="Herramientas de edición"\n          onClick={() => setMobileToolsOpen((open) => !open)}\n        >\n          ☷\n        </button>\n      </div>\n'''
new_dock = '''      {activeDockPanel === 'format' && (\n        <div className="editor-command-panel editor-command-panel--format" role="dialog" aria-label="Formato de texto">\n          <div className="editor-command-panel__heading"><strong>Formato</strong><span>Texto y estructura</span></div>\n          <div className="editor-command-grid">\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"bold\"]')}><strong>B</strong><span>Negrita</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"italic\"]')}><em>I</em><span>Cursiva</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"paragraph\"]')}><strong>P</strong><span>Párrafo</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"heading2\"]')}><strong>H2</strong><span>Título</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"heading3\"]')}><strong>H3</strong><span>Subtítulo</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"bulletList\"]')}><strong>•</strong><span>Lista</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"orderedList\"]')}><strong>1.</strong><span>Numerada</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"quote\"]')}><strong>❝</strong><span>Cita</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"link\"]')}><strong>↗</strong><span>Enlace</span></button>\n          </div>\n        </div>\n      )}\n\n      {activeDockPanel === 'insert' && (\n        <div className="editor-command-panel editor-command-panel--insert" role="dialog" aria-label="Insertar contenido">\n          <div className="editor-command-panel__heading"><strong>Insertar</strong><span>Contenido de la nota</span></div>\n          <div className="editor-command-grid editor-command-grid--insert">\n            <button type="button" onPointerDown={keepEditorSelection} onClick={triggerImageInsert}><strong>▧</strong><span>Imagen</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format=\"code\"]')}><strong>&lt;/&gt;</strong><span>Código</span></button>\n            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[title=\"Separador\"]')}><strong>—</strong><span>Separador</span></button>\n          </div>\n        </div>\n      )}\n\n      <div className="mobile-editor-dock" role="toolbar" aria-label="Acciones rápidas del editor">\n        <button\n          className="mobile-editor-dock__history"\n          type="button"\n          data-undo-tool="true"\n          aria-label="Deshacer último cambio"\n          title="Deshacer"\n          onClick={handleDockUndo}\n        >↶</button>\n        <button\n          className="mobile-editor-dock__history"\n          type="button"\n          data-redo-tool="true"\n          aria-label="Rehacer último cambio"\n          title="Rehacer"\n          onClick={handleDockRedo}\n        >↷</button>\n        <button\n          className="mobile-editor-dock__format"\n          type="button"\n          aria-label="Formato de texto"\n          aria-expanded={activeDockPanel === 'format'}\n          title="Formato"\n          onPointerDown={keepEditorSelection}\n          onClick={() => setActiveDockPanel((panel) => panel === 'format' ? null : 'format')}\n        >Aa</button>\n        <button\n          className="mobile-editor-dock__insert"\n          type="button"\n          aria-label="Insertar contenido"\n          aria-expanded={activeDockPanel === 'insert'}\n          title="Insertar"\n          onPointerDown={keepEditorSelection}\n          onClick={() => setActiveDockPanel((panel) => panel === 'insert' ? null : 'insert')}\n        >＋</button>\n      </div>\n'''
if old_dock not in text:
    raise SystemExit('Old editor dock marker not found')
text = text.replace(old_dock, new_dock, 1)

# use React.PointerEvent type via namespace import is unavailable; import type explicitly.
text = text.replace(
    "import { useEffect, useRef, useState, type ChangeEvent } from 'react'",
    "import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'",
    1,
)
text = text.replace('function keepEditorSelection(event: React.PointerEvent<HTMLButtonElement>)', 'function keepEditorSelection(event: ReactPointerEvent<HTMLButtonElement>)')
images.write_text(text, encoding='utf-8')

# ---------------------------------------------------------------------------
# 4. Code card: language + full screen + overflow menu. Long labels leave toolbar.
# ---------------------------------------------------------------------------
code = Path('src/features/editor/CodeBlockEditor.tsx')
text = code.read_text(encoding='utf-8')
start = text.index('function decorateCodeBlocks(root: HTMLElement): void {')
end = text.index('\ninterface CodeFullscreenDialog', start)
new_decorate = '''function decorateCodeBlocks(root: HTMLElement): void {\n  root.querySelectorAll<HTMLElement>('.editor-code-block__toolbar').forEach((toolbar) => {\n    if (toolbar.querySelector('[data-code-actions-toggle="true"]')) return\n\n    const copyButton = toolbar.querySelector<HTMLButtonElement>('[data-code-copy="true"]')\n    if (!copyButton) return\n\n    const actions = document.createElement('div')\n    actions.className = 'editor-code-block__toolbar-actions'\n\n    const expand = document.createElement('button')\n    expand.type = 'button'\n    expand.className = 'editor-code-block__expand'\n    expand.dataset.codeExpand = 'true'\n    expand.textContent = '⛶'\n    expand.title = 'Ver código completo'\n    expand.setAttribute('aria-label', 'Ver código completo y editarlo en pantalla completa')\n\n    const toggle = document.createElement('button')\n    toggle.type = 'button'\n    toggle.className = 'editor-code-block__actions-toggle'\n    toggle.dataset.codeActionsToggle = 'true'\n    toggle.textContent = '⋮'\n    toggle.title = 'Acciones del bloque de código'\n    toggle.setAttribute('aria-label', 'Acciones del bloque de código')\n    toggle.setAttribute('aria-haspopup', 'menu')\n    toggle.setAttribute('aria-expanded', 'false')\n\n    const menu = document.createElement('div')\n    menu.className = 'editor-code-block__actions-menu'\n    menu.dataset.codeActionsMenu = 'true'\n    menu.setAttribute('role', 'menu')\n    menu.hidden = true\n\n    copyButton.classList.add('editor-code-block__menu-action')\n    copyButton.setAttribute('role', 'menuitem')\n\n    const convert = document.createElement('button')\n    convert.type = 'button'\n    convert.className = 'editor-code-block__convert editor-code-block__menu-action'\n    convert.dataset.codeConvert = 'true'\n    convert.textContent = 'Convertir a texto'\n    convert.title = 'Quitar el formato de código y conservar todo el contenido'\n    convert.setAttribute('role', 'menuitem')\n\n    const remove = document.createElement('button')\n    remove.type = 'button'\n    remove.className = 'editor-code-block__delete editor-code-block__menu-action'\n    remove.dataset.codeDelete = 'true'\n    remove.textContent = 'Eliminar bloque'\n    remove.title = 'Eliminar el bloque y todo su contenido'\n    remove.setAttribute('role', 'menuitem')\n\n    menu.append(copyButton, convert, remove)\n    actions.append(expand, toggle, menu)\n    toolbar.append(actions)\n  })\n}\n'''
text = text[:start] + new_decorate + text[end:]

# Add actions-menu click behavior at the beginning of handleClick.
needle = '''    function handleClick(event: MouseEvent) {\n      const target = event.target\n      if (!(target instanceof Element)) return\n\n'''
insert = '''    function handleClick(event: MouseEvent) {\n      const target = event.target\n      if (!(target instanceof Element)) return\n\n      const actionToggle = target.closest<HTMLButtonElement>('[data-code-actions-toggle="true"]')\n      if (actionToggle && root.contains(actionToggle)) {\n        event.preventDefault()\n        event.stopPropagation()\n        const toolbar = actionToggle.closest<HTMLElement>('.editor-code-block__toolbar')\n        const menu = toolbar?.querySelector<HTMLElement>('[data-code-actions-menu="true"]')\n        if (!menu) return\n        const opening = menu.hidden\n        root.querySelectorAll<HTMLElement>('[data-code-actions-menu="true"]').forEach((candidate) => { candidate.hidden = true })\n        root.querySelectorAll<HTMLButtonElement>('[data-code-actions-toggle="true"]').forEach((candidate) => candidate.setAttribute('aria-expanded', 'false'))\n        menu.hidden = !opening\n        actionToggle.setAttribute('aria-expanded', String(opening))\n        return\n      }\n\n      const clickedCodeAction = target.closest('[data-code-copy="true"], [data-code-convert="true"], [data-code-delete="true"], [data-code-expand="true"]')\n      if (clickedCodeAction) {\n        const toolbar = clickedCodeAction.closest<HTMLElement>('.editor-code-block__toolbar')\n        const menu = toolbar?.querySelector<HTMLElement>('[data-code-actions-menu="true"]')\n        const toggle = toolbar?.querySelector<HTMLButtonElement>('[data-code-actions-toggle="true"]')\n        if (menu) menu.hidden = true\n        toggle?.setAttribute('aria-expanded', 'false')\n      }\n\n'''
if needle not in text:
    raise SystemExit('Code handleClick marker not found')
text = text.replace(needle, insert, 1)
code.write_text(text, encoding='utf-8')

# ---------------------------------------------------------------------------
# 5. CSS: fluid shell inspired by OAVIX principles. Breakpoints only change structure.
# ---------------------------------------------------------------------------
notes_css = Path('src/features/notes/notes.css')
notes_css.write_text('''
:root {
  --oanix-sidebar: clamp(17rem, 27vw, 23rem);
  --oanix-page-gap: clamp(0.75rem, 2.2vw, 2.25rem);
  --oanix-canvas-max: 72rem;
  --oanix-header-height: clamp(4rem, 6.4vw, 4.75rem);
}

.notes-shell {
  width: 100%;
  min-width: 0;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: var(--oanix-sidebar) minmax(0, 1fr);
  background: #eef2f5;
  color: #111827;
}

.notes-sidebar {
  position: sticky;
  top: 0;
  min-width: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #d9e0e7;
  background: #fff;
}

.notes-header,
.note-view__header {
  min-width: 0;
  min-height: var(--oanix-header-height);
  display: flex;
  align-items: center;
  gap: clamp(0.45rem, 1.3vw, 0.85rem);
  padding: max(0.65rem, env(safe-area-inset-top)) clamp(0.65rem, 1.5vw, 1rem) 0.65rem;
  border-bottom: 1px solid #e1e7ed;
  background: rgba(255,255,255,.95);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.notes-header { justify-content: space-between; }
.note-view__header { position: sticky; top: 0; z-index: 50; }

.notes-brand,
.note-view__identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: clamp(0.5rem, 1.3vw, 0.8rem);
}

.notes-brand > div:last-child,
.note-view__identity > div { min-width: 0; }

.notes-brand__mark,
.note-view__avatar,
.note-row__avatar,
.note-view__empty-mark {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: linear-gradient(145deg, #2563eb, #4f46e5);
  color: #fff;
  font-weight: 850;
}

.notes-brand__mark {
  width: clamp(2.3rem, 4vw, 2.75rem);
  height: clamp(2.3rem, 4vw, 2.75rem);
  border-radius: .85rem;
  background: #111827;
}

.notes-brand strong,
.note-view__identity strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes-brand span,
.note-view__identity span {
  display: block;
  min-width: 0;
  margin-top: .08rem;
  overflow: hidden;
  color: #7a8593;
  font-size: clamp(.7rem, 1.5vw, .8rem);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes-header__actions,
.note-view__actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: .35rem;
  flex: 0 0 auto;
}

.icon-button,
.back-button,
.note-view__menu-button {
  width: clamp(2.35rem, 4.5vw, 2.65rem);
  height: clamp(2.35rem, 4.5vw, 2.65rem);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #52606f;
  font: inherit;
  font-size: 1.15rem;
  font-weight: 800;
}

.icon-button:hover,
.icon-button:focus-visible,
.back-button:hover,
.back-button:focus-visible,
.note-view__menu-button:hover,
.note-view__menu-button:focus-visible,
.note-view__menu-button[aria-expanded='true'] {
  outline: none;
  background: #eef2f7;
  color: #1d4ed8;
}

.workspace-menu-wrap { position: relative; }
.workspace-menu,
.note-view__menu {
  position: absolute;
  z-index: 90;
  top: calc(100% + .35rem);
  right: 0;
  width: min(17rem, calc(100vw - 1.25rem));
  padding: .4rem;
  border: 1px solid #d9e0e7;
  border-radius: .9rem;
  background: #fff;
  box-shadow: 0 18px 45px rgba(15,23,42,.2);
}

.workspace-menu button,
.note-view__menu button {
  width: 100%;
  min-width: 0;
  min-height: 2.7rem;
  display: flex;
  align-items: center;
  gap: .65rem;
  padding: .55rem .7rem;
  border: 0;
  border-radius: .65rem;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: .84rem;
  font-weight: 750;
  text-align: left;
  overflow-wrap: anywhere;
}
.workspace-menu button:hover,
.note-view__menu button:hover { background: #f1f5f9; }
.note-view__menu-danger { color: #b42318 !important; }
.note-view__menu-danger:hover { background: #fff1f2 !important; }

.notes-tabs {
  display: flex;
  gap: .2rem;
  overflow-x: auto;
  padding: 0 .75rem;
  border-bottom: 1px solid #e8edf2;
  scrollbar-width: none;
}
.notes-tabs::-webkit-scrollbar { display: none; }
.notes-tab {
  position: relative;
  flex: 0 0 auto;
  min-width: 4.5rem;
  padding: .85rem .7rem .75rem;
  border: 0;
  background: transparent;
  color: #7a8593;
  font-weight: 800;
}
.notes-tab--active { color: #2563eb; }
.notes-tab--active::after {
  content: '';
  position: absolute;
  right: .65rem;
  bottom: 0;
  left: .65rem;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: #2563eb;
}

.notes-error,
.note-save-error {
  margin: .75rem;
  padding: .75rem .85rem;
  border: 1px solid #fecaca;
  border-radius: .8rem;
  background: #fff1f2;
  color: #991b1b;
  font-size: .82rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.note-save-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  margin: 1rem 0 0;
}
.note-save-error span { min-width: 0; }
.note-save-error button {
  flex: 0 0 auto;
  min-height: 2.35rem;
  padding: 0 .75rem;
  border: 1px solid #b42318;
  border-radius: .65rem;
  background: #fff;
  color: #b42318;
  font: inherit;
  font-weight: 800;
}

.notes-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: .35rem 0 6rem;
}
.note-row {
  position: relative;
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: stretch;
  background: transparent;
}
.note-row:hover { background: #f5f7f9; }
.note-row--selected,
.note-row--menu-open { background: #e7f0ff; }
.note-row__open {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: clamp(.55rem, 1.5vw, .8rem);
  padding: .7rem .3rem .7rem clamp(.65rem, 1.5vw, .9rem);
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}
.note-row__open:focus-visible { outline: none; box-shadow: inset 3px 0 #2563eb; }
.note-row__avatar {
  width: clamp(2.55rem, 5vw, 3.1rem);
  height: clamp(2.55rem, 5vw, 3.1rem);
  font-size: .95rem;
}
.note-row__body { min-width: 0; flex: 1; display: grid; gap: .2rem; }
.note-row__topline { min-width: 0; display: flex; align-items: baseline; gap: .6rem; }
.note-row__topline strong { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .94rem; }
.note-row__topline time { flex: 0 0 auto; color: #8a94a2; font-size: .7rem; }
.note-row__preview { overflow: hidden; color: #7a8593; font-size: .8rem; text-overflow: ellipsis; white-space: nowrap; }
.note-row__menu-wrap { position: relative; flex: 0 0 auto; display: grid; place-items: center; padding-right: .45rem; }
.note-row__menu-button {
  width: 2.35rem; height: 2.35rem; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: #64748b; font-size: 1.25rem;
}
.note-row__menu-button:hover,
.note-row__menu-button:focus-visible,
.note-row__menu-button[aria-expanded='true'] { outline: none; background: #dbeafe; color: #1d4ed8; }
.note-row__menu {
  position: absolute; z-index: 70; top: calc(100% - .15rem); right: .25rem; min-width: 10.5rem; padding: .35rem;
  border: 1px solid #d9e0e7; border-radius: .75rem; background: #fff; box-shadow: 0 14px 34px rgba(15,23,42,.18);
}
.note-row__menu--up { top: auto; bottom: calc(100% - .15rem); }
.note-row__menu button { width: 100%; min-height: 2.45rem; padding: .45rem .7rem; border: 0; border-radius: .55rem; background: transparent; text-align: left; font: inherit; font-size: .82rem; font-weight: 750; white-space: normal; }
.note-row__menu-danger { color: #b42318; }
.note-row__menu-danger:hover { background: #fff1f2; }

.notes-create-fab {
  position: absolute;
  z-index: 25;
  right: clamp(.75rem, 2vw, 1rem);
  bottom: max(.85rem, env(safe-area-inset-bottom));
  min-height: 3.15rem;
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  padding: 0 1rem;
  border: 0;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 14px 34px rgba(37,99,235,.32);
  font: inherit;
  font-weight: 850;
}
.notes-create-fab span:first-child { font-size: 1.25rem; }
.notes-create-fab:disabled { opacity: .6; }

.notes-empty,
.note-view__empty {
  min-height: 18rem;
  display: grid;
  place-items: center;
  align-content: center;
  gap: .45rem;
  padding: clamp(1.25rem, 4vw, 2.5rem);
  text-align: center;
  color: #66717f;
}
.notes-empty p,
.note-view__empty p { margin: 0; line-height: 1.5; }
.notes-empty__icon,
.note-view__empty-mark { width: 3.1rem; height: 3.1rem; display: grid; place-items: center; border-radius: 1rem; background: #eaf2ff; color: #2563eb; }
.empty-action { margin-top: .45rem; padding: .7rem .9rem; border: 0; border-radius: .7rem; background: #2563eb; color: #fff; font: inherit; font-weight: 800; }

.note-view {
  min-width: 0;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at 72% 20%, rgba(37,99,235,.07), transparent 28rem), #eef2f5;
  container-type: inline-size;
}
.note-view__identity { flex: 1; }
.note-view__avatar { width: clamp(2.45rem, 4.4vw, 2.8rem); height: clamp(2.45rem, 4.4vw, 2.8rem); }
.back-button { display: none; }

.note-canvas {
  width: min(calc(100% - 2 * var(--oanix-page-gap)), var(--oanix-canvas-max));
  margin: 0 auto;
  padding: clamp(1.15rem, 3.2vw, 3rem) 0 max(7rem, calc(5rem + env(safe-area-inset-bottom)));
}
.note-title-field { display: grid; gap: .4rem; min-width: 0; }
.note-title-field span { color: #7a8593; font-size: .7rem; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
.note-title-field input {
  width: 100%; min-width: 0; padding: 0; border: 0; outline: 0; background: transparent; color: #111827;
  font-size: clamp(1.9rem, 5.2cqw, 3.6rem); font-weight: 850; line-height: 1.04; letter-spacing: -.04em; overflow-wrap: anywhere;
}

.note-info-dialog {
  position: fixed; z-index: 1600; inset: 0; display: grid; place-items: center; padding: 1rem;
  background: rgba(15,23,42,.48); backdrop-filter: blur(5px);
}
.note-info-dialog__panel { width: min(28rem, 100%); max-height: min(86dvh, 40rem); overflow: auto; padding: 1rem; border: 1px solid #d8e0ea; border-radius: 1rem; background: #fff; box-shadow: 0 24px 70px rgba(15,23,42,.25); }
.note-info-dialog__header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.note-info-dialog__header button { width: 2.4rem; height: 2.4rem; border: 0; border-radius: 50%; background: #f1f5f9; font-size: 1.25rem; }
.note-info-dialog dl { display: grid; gap: .75rem; margin: 1rem 0 0; }
.note-info-dialog dl > div { display: grid; grid-template-columns: minmax(7rem, .55fr) minmax(0, 1fr); gap: .75rem; padding: .7rem 0; border-top: 1px solid #eef2f6; }
.note-info-dialog dt { color: #64748b; font-size: .78rem; font-weight: 800; }
.note-info-dialog dd { min-width: 0; margin: 0; color: #1e293b; font-size: .82rem; overflow-wrap: anywhere; }

@media (max-width: 720px) {
  :root { --oanix-page-gap: clamp(.55rem, 3.2vw, .9rem); }
  .notes-shell { display: block; min-height: 100dvh; background: #fff; }
  .notes-sidebar { position: relative; height: 100dvh; border-right: 0; }
  .note-view { display: none; }
  .notes-shell--open .notes-sidebar { display: none; }
  .notes-shell--open .note-view { display: flex; }
  .back-button { display: grid; }
  .notes-brand span { display: none; }
  .note-canvas { width: min(calc(100% - 2 * var(--oanix-page-gap)), var(--oanix-canvas-max)); }
  .note-title-field input { font-size: clamp(2rem, 10cqw, 3rem); }
  .note-save-error { align-items: stretch; flex-direction: column; }
  .note-save-error button { width: 100%; }
  .note-info-dialog dl > div { grid-template-columns: 1fr; gap: .2rem; }
}

@media (min-width: 721px) {
  .notes-create-fab span:last-child { display: none; }
  .notes-create-fab { width: 3.15rem; justify-content: center; padding: 0; }
}

@media (min-width: 1180px) {
  :root { --oanix-sidebar: clamp(19rem, 23vw, 25rem); }
}
'''.strip() + '\n', encoding='utf-8')

# Hidden native toolbar remains the command engine; visual UI is the dock/panels.
append_once('src/features/editor/editor.css', 'OANIX fluid command surface v2', '''
/* OANIX fluid command surface v2 */
.editor-frame {
  min-width: 0;
  margin-top: clamp(1rem, 2.2vw, 1.5rem);
  grid-template-rows: minmax(clamp(26rem, 62dvh, 48rem), auto) !important;
  overflow: visible;
}
.editor-toolbar { display: none !important; }
.editor-surface {
  min-width: 0;
  min-height: clamp(26rem, 62dvh, 48rem);
  padding: clamp(1rem, 3.5cqw, 2rem);
  padding-bottom: clamp(6rem, 12dvh, 8rem);
  font-size: clamp(.98rem, 2.2cqw, 1.08rem);
}
.editor-surface h1 { font-size: clamp(1.65rem, 5cqw, 2rem); }
.editor-surface h2 { font-size: clamp(1.4rem, 4.2cqw, 1.7rem); }
.editor-surface h3 { font-size: clamp(1.18rem, 3.5cqw, 1.35rem); }
.editor-code-block { max-width: 100%; }
.editor-code-block__content {
  max-width: 100%;
  overflow-x: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
@container (max-width: 34rem) {
  .editor-frame { border-radius: 1rem; }
  .editor-surface { padding-inline: clamp(.85rem, 4cqw, 1.15rem); }
}
''')

append_once('src/features/images/images.css', 'OANIX adaptive editor dock v2', '''
/* OANIX adaptive editor dock v2 */
.image-note-editor-root { min-width: 0; container-type: inline-size; }
.mobile-editor-dock {
  position: fixed !important;
  z-index: 1330;
  right: max(.75rem, env(safe-area-inset-right));
  bottom: max(.7rem, env(safe-area-inset-bottom));
  display: flex !important;
  align-items: center;
  gap: .2rem;
  padding: .32rem;
  border: 1px solid rgba(203,213,225,.9);
  border-radius: 999px;
  background: rgba(255,255,255,.97);
  box-shadow: 0 14px 38px rgba(15,23,42,.24);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.mobile-editor-dock button {
  width: clamp(2.55rem, 8vw, 2.9rem);
  height: clamp(2.55rem, 8vw, 2.9rem);
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #475569;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 850;
}
.mobile-editor-dock button:disabled { opacity: .3; }
.mobile-editor-dock__format,
.mobile-editor-dock__insert { background: #eef2f7 !important; }
.mobile-editor-dock__insert { background: #2563eb !important; color: #fff !important; font-size: 1.35rem !important; }
.mobile-editor-dock__format[aria-expanded='true'],
.mobile-editor-dock__insert[aria-expanded='true'] { box-shadow: 0 0 0 3px rgba(37,99,235,.18); }

.editor-command-panel {
  position: fixed;
  z-index: 1325;
  right: max(.75rem, env(safe-area-inset-right));
  bottom: calc(4.45rem + env(safe-area-inset-bottom));
  width: min(31rem, calc(100vw - 1.5rem));
  max-height: min(62dvh, 34rem);
  overflow: auto;
  padding: .75rem;
  border: 1px solid #d8e0ea;
  border-radius: 1rem;
  background: rgba(255,255,255,.98);
  box-shadow: 0 20px 55px rgba(15,23,42,.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.editor-command-panel__heading { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; padding: .1rem .15rem .65rem; }
.editor-command-panel__heading strong { color: #172033; font-size: .9rem; }
.editor-command-panel__heading span { color: #7a8593; font-size: .7rem; }
.editor-command-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr)); gap: .4rem; }
.editor-command-grid button {
  min-width: 0;
  min-height: 4rem;
  display: grid;
  place-items: center;
  align-content: center;
  gap: .2rem;
  padding: .5rem .35rem;
  border: 1px solid #e0e6ed;
  border-radius: .75rem;
  background: #f8fafc;
  color: #334155;
  font: inherit;
}
.editor-command-grid button:hover,
.editor-command-grid button:focus-visible { outline: none; border-color: #b9cdfd; background: #eef4ff; color: #1d4ed8; }
.editor-command-grid button > strong,
.editor-command-grid button > em { font-size: 1rem; }
.editor-command-grid button > span { min-width: 0; font-size: .68rem; font-weight: 750; overflow-wrap: anywhere; }

.image-note-editor-root .editor-image-block { max-width: 100%; box-sizing: border-box; }
.image-note-editor-root .editor-image-block__actions { display: flex; flex-wrap: wrap; gap: .35rem; }
.image-note-editor-root .editor-image-block__actions button { white-space: nowrap; }

@container (max-width: 34rem) {
  .image-note-editor-root .editor-surface > .editor-image-block {
    float: none !important;
    clear: both;
    max-width: calc(100% - .35rem);
  }
  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__footer {
    position: fixed !important;
    z-index: 1340;
    right: .75rem !important;
    bottom: calc(4.5rem + env(safe-area-inset-bottom));
    left: .75rem !important;
    top: auto !important;
    width: auto !important;
    max-width: none !important;
    transform: none !important;
    padding: .75rem;
    border: 1px solid #d8e0ea;
    border-radius: 1rem;
    box-shadow: 0 20px 55px rgba(15,23,42,.24);
  }
  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__actions {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
  }
  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__actions button {
    width: auto !important;
    min-width: max-content !important;
    flex: 0 0 auto;
    white-space: nowrap !important;
  }
  .image-note-editor-root .editor-image-block[data-image-compact='true'][data-image-info-open='true'] .editor-image-block__alignment {
    width: auto !important;
    display: inline-flex !important;
    grid-column: auto !important;
  }
}

@media (max-width: 420px) {
  .editor-command-panel { right: .5rem; left: .5rem; width: auto; }
  .editor-command-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
''')

append_once('src/features/editor/codeBlockEditor.css', 'OANIX compact code action menu v2', '''
/* OANIX compact code action menu v2 */
.code-block-editor-root .editor-code-block__toolbar {
  position: relative;
  display: flex !important;
  align-items: center !important;
  gap: .5rem !important;
  min-width: 0;
  padding: .45rem .55rem !important;
}
.code-block-editor-root .editor-code-block__language {
  min-width: 0;
  width: auto !important;
  max-width: min(13rem, 55%) !important;
  flex: 1 1 auto;
  grid-column: auto !important;
}
.code-block-editor-root .editor-code-block__toolbar-actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: .25rem;
  flex: 0 0 auto;
  margin-left: auto;
}
.code-block-editor-root .editor-code-block__expand,
.code-block-editor-root .editor-code-block__actions-toggle {
  width: 2.35rem !important;
  min-width: 2.35rem !important;
  height: 2.35rem;
  min-height: 2.35rem !important;
  display: grid;
  place-items: center;
  padding: 0 !important;
  border: 0;
  border-radius: .65rem;
  background: transparent;
  color: #cbd5e1;
  font: inherit;
  font-size: 1.1rem !important;
  font-weight: 800;
}
.code-block-editor-root .editor-code-block__expand:hover,
.code-block-editor-root .editor-code-block__actions-toggle:hover,
.code-block-editor-root .editor-code-block__actions-toggle[aria-expanded='true'] { background: #26354e; color: #fff; }
.code-block-editor-root .editor-code-block__actions-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + .35rem);
  right: 0;
  width: min(13rem, calc(100vw - 2rem));
  padding: .35rem;
  border: 1px solid #334155;
  border-radius: .8rem;
  background: #111c31;
  box-shadow: 0 16px 38px rgba(2,6,23,.45);
}
.code-block-editor-root .editor-code-block__actions-menu[hidden] { display: none !important; }
.code-block-editor-root .editor-code-block__actions-menu button {
  width: 100% !important;
  min-width: 0 !important;
  min-height: 2.55rem !important;
  display: flex;
  align-items: center;
  margin: 0 !important;
  padding: .5rem .65rem !important;
  border: 0;
  border-radius: .55rem;
  background: transparent;
  color: #d8e2f0;
  font: inherit;
  font-size: .78rem !important;
  text-align: left !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
}
.code-block-editor-root .editor-code-block__actions-menu button:hover { background: #1e2b42; }
.code-block-editor-root .editor-code-block__actions-menu .editor-code-block__delete { color: #fca5a5; }
.code-block-editor-root .editor-code-block__content {
  max-height: clamp(14rem, 42dvh, 24rem);
  overflow-x: hidden !important;
  overflow-y: auto;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word;
}
''')

# ---------------------------------------------------------------------------
# 6. Documentation: record the structural responsive change and save root cause.
# ---------------------------------------------------------------------------
changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
anchor = '## Unreleased\n'
addition = '''## Unreleased\n- Corregida incompatibilidad de guardado: las imágenes reducidas en móvil ya son válidas para el modelo persistido y no invalidan la nota al releerla.\n- Shell fluido inspirado en la estrategia responsive de OAVIX: tamaños gobernados por contenedores, `clamp`, `minmax`, wrap y un único conjunto de componentes.\n- Nueva cabecera de nota con menú `⋮`, información y eliminación; creación de nota mediante botón flotante.\n- Dock persistente `↶ ↷ Aa ＋`: formato e inserción separados en paneles adaptativos.\n- Bloques de código simplificados a lenguaje + pantalla completa + menú `⋮` para copiar/convertir/eliminar.\n'''
if anchor not in text:
    raise SystemExit('CHANGELOG Unreleased anchor not found')
text = text.replace(anchor, addition, 1)
changelog.write_text(text, encoding='utf-8')

roadmap = Path('docs/ROADMAP.md')
text = roadmap.read_text(encoding='utf-8')
marker = '- [ ] Validación visual/táctil final en dispositivo real antes de cerrar el bloque.\n'
if marker in text and 'shell fluido tipo OAVIX' not in text:
    text = text.replace(marker, marker + '- [ ] Validar shell fluido tipo OAVIX en anchos continuos (teléfono estrecho → tablet → escritorio grande), sin layouts duplicados por dispositivo.\n', 1)
roadmap.write_text(text, encoding='utf-8')
