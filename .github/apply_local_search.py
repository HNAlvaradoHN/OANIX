from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected marker not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if marker in text:
        return
    p.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


workspace = 'src/features/notes/NotesWorkspace.tsx'

replace_once(
    workspace,
    "import { prepareDailyEntriesForEditing } from './dailyEntries'\n",
    "import { filterNotesByLocalSearch } from '../search/localSearch'\nimport { prepareDailyEntriesForEditing } from './dailyEntries'\n",
)

replace_once(
    workspace,
    "  const [savingNoteTags, setSavingNoteTags] = useState(false)\n  const [selectedId, setSelectedId] = useState<string | null>(null)\n",
    "  const [savingNoteTags, setSavingNoteTags] = useState(false)\n  const [searchOpen, setSearchOpen] = useState(false)\n  const [searchQuery, setSearchQuery] = useState('')\n  const [selectedId, setSelectedId] = useState<string | null>(null)\n",
)

replace_once(
    workspace,
    "  const folderTabsRef = useRef<HTMLElement | null>(null)\n  const pendingContentRef = useRef<PendingContent | null>(null)\n",
    "  const folderTabsRef = useRef<HTMLElement | null>(null)\n  const searchInputRef = useRef<HTMLInputElement | null>(null)\n  const pendingContentRef = useRef<PendingContent | null>(null)\n",
)

replace_once(
    workspace,
    """  const visibleNotes = useMemo(
    () => notes.filter((note) =>
      (activeFolderId === 'all' || note.folderId === activeFolderId) &&
      (activeTagId === 'all' || (note.tagIds ?? []).includes(activeTagId)),
    ),
    [notes, activeFolderId, activeTagId],
  )
""",
    """  const visibleNotes = useMemo(() => {
    const organized = notes.filter((note) =>
      (activeFolderId === 'all' || note.folderId === activeFolderId) &&
      (activeTagId === 'all' || (note.tagIds ?? []).includes(activeTagId)),
    )
    return filterNotesByLocalSearch(organized, searchQuery)
  }, [notes, activeFolderId, activeTagId, searchQuery])
  const hasSearchQuery = searchQuery.trim().length > 0
""",
)

replace_once(
    workspace,
    """        setTagFilterOpen(false)
        setTagManagerOpen(false)
        setTagEditorNoteId(null)
""",
    """        setTagFilterOpen(false)
        setTagManagerOpen(false)
        setTagEditorNoteId(null)
        setSearchOpen(false)
        setSearchQuery('')
""",
)

replace_once(
    workspace,
    """  async function handleLockWorkspace() {
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()
    onLock()
  }

  function handleTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
""",
    """  async function handleLockWorkspace() {
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()
    onLock()
  }

  async function handleToggleSearch() {
    if (searchOpen) {
      setSearchOpen(false)
      setSearchQuery('')
      return
    }

    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    selectedIdRef.current = null
    setSelectedId(null)
    setSaveState('idle')
    setNoteMenuId(null)
    setActiveNoteMenuOpen(false)
    setNoteInfoOpen(false)
    setWorkspaceMenuOpen(false)
    setSearchOpen(true)

    if (mobileSinglePane()) {
      window.history.replaceState({ ...currentHistoryState(), oanixView: 'list' }, '')
    }

    window.requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  function handleTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
""",
)

replace_once(
    workspace,
    """          <div className=\"notes-header__actions\" data-note-menu-root=\"true\">
            <button
              className=\"icon-button\"
              type=\"button\"
              onClick={() => void handleLockWorkspace()}
""",
    """          <div className=\"notes-header__actions\" data-note-menu-root=\"true\">
            <button
              className={`icon-button${searchOpen ? ' icon-button--active' : ''}`}
              type=\"button\"
              onClick={() => void handleToggleSearch()}
              aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar en notas'}
              aria-pressed={searchOpen}
              title={searchOpen ? 'Cerrar búsqueda' : 'Buscar'}
            >
              🔍
            </button>
            <button
              className=\"icon-button\"
              type=\"button\"
              onClick={() => void handleLockWorkspace()}
""",
)

replace_once(
    workspace,
    """        </header>

        <div className=\"notes-tabs-shell\">
""",
    """        </header>

        {searchOpen && (
          <div className=\"notes-search\" role=\"search\" aria-label=\"Búsqueda local de notas\">
            <div className=\"notes-search__field\">
              <span aria-hidden=\"true\">🔍</span>
              <input
                ref={searchInputRef}
                type=\"search\"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder=\"Buscar en tus notas\"
                autoComplete=\"off\"
                spellCheck={false}
                aria-label=\"Buscar en títulos y contenido de notas\"
              />
              {hasSearchQuery && (
                <button
                  type=\"button\"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                  aria-label=\"Limpiar búsqueda\"
                  title=\"Limpiar\"
                >
                  ×
                </button>
              )}
            </div>
            <div className=\"notes-search__meta\" aria-live=\"polite\">
              {hasSearchQuery
                ? `${visibleNotes.length} resultado${visibleNotes.length === 1 ? '' : 's'}`
                : 'Solo busca en el contenido descifrado de este dispositivo'}
            </div>
          </div>
        )}

        <div className=\"notes-tabs-shell\">
""",
)

replace_once(
    workspace,
    """          ) : visibleNotes.length === 0 ? (
            <div className=\"notes-empty\">
              <div className=\"notes-empty__icon\" aria-hidden=\"true\">{activeTag ? '🏷' : '📁'}</div>
              <strong>{activeTag ? 'No hay notas con esta etiqueta' : 'Esta carpeta está vacía'}</strong>
              <p>
                {activeTag
                  ? `Las notas nuevas creadas con este filtro recibirán “${activeTag.name}”.`
                  : 'Las notas que crees aquí quedarán organizadas en esta carpeta cifrada.'}
              </p>
              <button className=\"empty-action\" type=\"button\" onClick={() => void handleCreateNote()} disabled={creating}>
                Crear nota aquí
              </button>
            </div>
""",
    """          ) : visibleNotes.length === 0 ? (
            hasSearchQuery ? (
              <div className=\"notes-empty\">
                <div className=\"notes-empty__icon\" aria-hidden=\"true\">🔍</div>
                <strong>Sin resultados</strong>
                <p>No encontramos “{searchQuery.trim()}” dentro de las notas de los filtros actuales.</p>
                <button
                  className=\"empty-action\"
                  type=\"button\"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              <div className=\"notes-empty\">
                <div className=\"notes-empty__icon\" aria-hidden=\"true\">{activeTag ? '🏷' : '📁'}</div>
                <strong>{activeTag ? 'No hay notas con esta etiqueta' : 'Esta carpeta está vacía'}</strong>
                <p>
                  {activeTag
                    ? `Las notas nuevas creadas con este filtro recibirán “${activeTag.name}”.`
                    : 'Las notas que crees aquí quedarán organizadas en esta carpeta cifrada.'}
                </p>
                <button className=\"empty-action\" type=\"button\" onClick={() => void handleCreateNote()} disabled={creating}>
                  Crear nota aquí
                </button>
              </div>
            )
""",
)

replace_once(
    workspace,
    """        <button
          className=\"notes-create-fab\"
          type=\"button\"
          onClick={() => void handleCreateNote()}
          disabled={creating}
          aria-label={creating ? 'Creando nota' : 'Crear nueva nota'}
          title=\"Nueva nota\"
        >
          <span aria-hidden=\"true\">＋</span>
          <span>{creating ? 'Creando…' : 'Nueva nota'}</span>
        </button>
""",
    """        {!hasSearchQuery && (
          <button
            className=\"notes-create-fab\"
            type=\"button\"
            onClick={() => void handleCreateNote()}
            disabled={creating}
            aria-label={creating ? 'Creando nota' : 'Crear nueva nota'}
            title=\"Nueva nota\"
          >
            <span aria-hidden=\"true\">＋</span>
            <span>{creating ? 'Creando…' : 'Nueva nota'}</span>
          </button>
        )}
""",
)

append_once(
    'src/features/notes/notes.css',
    '/* Local search */',
    r'''
/* Local search */
.icon-button--active { background: #eef4ff; color: #1d4ed8; }
.notes-search {
  min-width: 0;
  display: grid;
  gap: .35rem;
  padding: .55rem clamp(.55rem, 1.5vw, .75rem) .5rem;
  border-bottom: 1px solid #e8edf2;
  background: #fbfcfe;
}
.notes-search__field {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: .45rem;
  min-height: 2.65rem;
  padding: .25rem .35rem .25rem .7rem;
  border: 1px solid #cfd9e5;
  border-radius: .85rem;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.notes-search__field:focus-within {
  border-color: #8fb0ff;
  box-shadow: 0 0 0 3px rgba(37,99,235,.09);
}
.notes-search__field input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #172033;
  font: inherit;
  font-size: .86rem;
}
.notes-search__field input::placeholder { color: #8a94a2; }
.notes-search__field button {
  width: 2.1rem;
  height: 2.1rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 1.15rem;
  font-weight: 800;
}
.notes-search__field button:hover,
.notes-search__field button:focus-visible { outline: none; background: #eef2f7; color: #1d4ed8; }
.notes-search__meta {
  min-width: 0;
  padding-inline: .15rem;
  color: #7a8593;
  font-size: .68rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
@media (max-width: 380px) {
  .notes-search { padding-inline: .5rem; }
  .notes-search__field { min-height: 2.5rem; }
}
''',
)

replace_once(
    'docs/ROADMAP.md',
    '- [ ] Búsqueda local\n- [ ] Backup/exportación cifrada\n',
    '- [x] Búsqueda local\n- [ ] Backup/exportación cifrada\n',
)
replace_once(
    'docs/ROADMAP.md',
    '**Siguiente bloque de trabajo:** Búsqueda local.\n',
    '**Siguiente bloque de trabajo:** Backup/exportación cifrada.\n',
)

changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
entry = '- Búsqueda local V1 sobre contenido ya descifrado en memoria, insensible a mayúsculas/acentos y combinable con Carpetas + Etiquetas, sin persistir un índice en texto plano.\n'
if entry not in text:
    text = text.replace('## Unreleased\n', '## Unreleased\n' + entry, 1)
    changelog.write_text(text, encoding='utf-8')

security = Path('docs/SECURITY.md')
text = security.read_text(encoding='utf-8')
marker = '### Búsqueda local\n'
if marker not in text:
    anchor = '### Comprobación de almacenamiento cifrado\n'
    section = '''### Búsqueda local\n\nLa búsqueda de V1 se ejecuta únicamente sobre las notas que ya fueron descifradas en memoria después de desbloquear la bóveda. OANIX no crea ni persiste un índice de búsqueda en texto plano, no envía consultas ni contenido a servicios externos y descarta el estado de búsqueda al cerrar o recargar la sesión.\n\nEl buscador reutiliza la representación de texto plano en memoria del modelo `blocks-v1`, por lo que puede localizar título, texto enriquecido, código, checklists, contactos, títulos de entradas por día y metadatos textuales de imágenes que ya forman parte del registro cifrado de la nota.\n\n'''
    if anchor not in text:
        raise SystemExit('SECURITY anchor not found')
    text = text.replace(anchor, section + anchor, 1)
    security.write_text(text, encoding='utf-8')
