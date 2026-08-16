from pathlib import Path

workspace = Path('src/features/notes/NotesWorkspace.tsx')
text = workspace.read_text()

replacements = []

replacements.append((
"import { filterByLocalSearch } from '../search/localSearch'",
"import { searchItemsByLocalFields, type LocalSearchField } from '../search/localSearch'",
))

old_preview = """function notePreview(note: NoteRecord): string {
  return noteBlocksToPlainText(note.content.blocks) || 'Nota vacía · empieza a escribir'
}

function saveStateLabel(saveState: SaveState, savingTitle: boolean): string {
"""
new_preview = """function notePreview(note: NoteRecord): string {
  return noteBlocksToPlainText(note.content.blocks) || 'Nota vacía · empieza a escribir'
}

function richRunsText(runs: Array<{ text: string }>): string {
  return runs.map((run) => run.text).join('')
}

function noteLocalSearchFields(note: NoteRecord): LocalSearchField[] {
  const fields: LocalSearchField[] = [
    { key: `${note.id}:title`, label: 'Título', text: note.title },
  ]

  note.content.blocks.forEach((block, blockIndex) => {
    const key = `${note.id}:${block.id || blockIndex}`

    if (block.type === 'paragraph') {
      fields.push({ key, label: 'Texto', text: richRunsText(block.runs) })
      return
    }
    if (block.type === 'heading') {
      fields.push({ key, label: 'Encabezado', text: richRunsText(block.runs) })
      return
    }
    if (block.type === 'quote') {
      fields.push({ key, label: 'Cita', text: richRunsText(block.runs) })
      return
    }
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      block.items.forEach((item, itemIndex) => {
        fields.push({ key: `${key}:item:${itemIndex}`, label: 'Lista', text: richRunsText(item) })
      })
      return
    }
    if (block.type === 'checklist') {
      block.items.forEach((item, itemIndex) => {
        fields.push({ key: `${key}:check:${itemIndex}`, label: 'Checklist', text: item.text })
      })
      return
    }
    if (block.type === 'contact') {
      const contactFields = [
        ['Nombre de contacto', block.name],
        ['Teléfono de contacto', block.phone],
        ['Correo de contacto', block.email],
        ['Organización', block.organization],
        ['Notas de contacto', block.notes],
      ] as const
      contactFields.forEach(([label, value], fieldIndex) => {
        if (value.trim()) fields.push({ key: `${key}:contact:${fieldIndex}`, label, text: value })
      })
      return
    }
    if (block.type === 'dailyEntry') {
      if (block.title.trim()) fields.push({ key, label: 'Entrada del día', text: block.title })
      return
    }
    if (block.type === 'code') {
      fields.push({ key, label: `Código · ${block.language}`, text: block.text })
      return
    }
    if (block.type === 'image') {
      if (block.alt?.trim()) {
        fields.push({ key: `${key}:description`, label: 'Imagen · descripción', text: block.alt })
      }
      if (block.showName !== false && block.name.trim()) {
        fields.push({ key: `${key}:name`, label: 'Imagen · nombre', text: block.name })
      }
    }
  })

  return fields.filter((field) => field.text.trim().length > 0)
}

function saveStateLabel(saveState: SaveState, savingTitle: boolean): string {
"""
replacements.append((old_preview, new_preview))

old_visible = """  const visibleNotes = useMemo(() => {
    const organized = notes.filter((note) =>
      (activeFolderId === 'all' || note.folderId === activeFolderId) &&
      (activeTagId === 'all' || (note.tagIds ?? []).includes(activeTagId)),
    )
    return filterByLocalSearch(organized, searchQuery, (note) => `${note.title}\\n${noteBlocksToPlainText(note.content.blocks)}`)
  }, [notes, activeFolderId, activeTagId, searchQuery])
  const hasSearchQuery = searchQuery.trim().length > 0
"""
new_visible = """  const hasSearchQuery = searchQuery.trim().length > 0
  const organizedNotes = useMemo(
    () => notes.filter((note) =>
      (activeFolderId === 'all' || note.folderId === activeFolderId) &&
      (activeTagId === 'all' || (note.tagIds ?? []).includes(activeTagId)),
    ),
    [notes, activeFolderId, activeTagId],
  )
  const searchResults = useMemo(
    () => hasSearchQuery
      ? searchItemsByLocalFields(notes, searchQuery, noteLocalSearchFields)
      : [],
    [notes, searchQuery, hasSearchQuery],
  )
  const searchResultByNoteId = useMemo(
    () => new Map(searchResults.map((result) => [result.item.id, result])),
    [searchResults],
  )
  const searchOccurrenceCount = useMemo(
    () => searchResults.reduce((total, result) => total + result.totalOccurrences, 0),
    [searchResults],
  )
  const visibleNotes = hasSearchQuery
    ? searchResults.map((result) => result.item)
    : organizedNotes
"""
replacements.append((old_visible, new_visible))

old_close_search = """    if (searchOpen) {
      setSearchOpen(false)
      setSearchQuery('')
      return
    }
"""
new_close_search = """    if (searchOpen) {
      const openNote = selectedIdRef.current
        ? notesRef.current.find((note) => note.id === selectedIdRef.current) ?? null
        : null
      if (openNote) {
        setActiveFolderId(openNote.folderId ?? 'all')
        if (activeTagId !== 'all' && !(openNote.tagIds ?? []).includes(activeTagId)) {
          setActiveTagId('all')
        }
      }
      setSearchOpen(false)
      setSearchQuery('')
      return
    }
"""
replacements.append((old_close_search, new_close_search))

replacements.append((
"    <main className={`notes-shell${selectedNote ? ' notes-shell--open' : ''}`}>",
"    <main className={`notes-shell${selectedNote ? ' notes-shell--open' : ''}${hasSearchQuery ? ' notes-shell--searching' : ''}`}>",
))

replacements.append((
'                placeholder="Buscar en tus notas"',
'                placeholder="Buscar en toda la bóveda"',
))

old_meta = """              {hasSearchQuery
                ? `${visibleNotes.length} resultado${visibleNotes.length === 1 ? '' : 's'}`
                : 'Solo busca en el contenido descifrado de este dispositivo'}
"""
new_meta = """              {hasSearchQuery
                ? `${searchResults.length} nota${searchResults.length === 1 ? '' : 's'} · ${searchOccurrenceCount} coincidencia${searchOccurrenceCount === 1 ? '' : 's'} · búsqueda global`
                : 'Busca en todas las carpetas y etiquetas · solo contenido descifrado localmente'}
"""
replacements.append((old_meta, new_meta))

replacements.append((
'                <p>No encontramos “{searchQuery.trim()}” dentro de las notas de los filtros actuales.</p>',
'                <p>No encontramos “{searchQuery.trim()}” en ninguna nota de la bóveda.</p>',
))

old_preview_row = '                    <span className="note-row__preview">{notePreview(note)}</span>'
new_preview_row = """                    <span className="note-row__preview">
                      {hasSearchQuery
                        ? `📁 ${folderName(note.folderId)} · ${searchResultByNoteId.get(note.id)?.totalOccurrences ?? 0} coincidencia${(searchResultByNoteId.get(note.id)?.totalOccurrences ?? 0) === 1 ? '' : 's'}`
                        : notePreview(note)}
                    </span>
                    {hasSearchQuery && searchResultByNoteId.get(note.id) && (
                      <span className="search-result-locations" aria-label="Ubicaciones de las coincidencias">
                        {searchResultByNoteId.get(note.id)?.matches.slice(0, 4).map((match) => (
                          <span className="search-result-location" key={match.key}>
                            <span className="search-result-location__label">
                              {match.label}{match.occurrences > 1 ? ` · ${match.occurrences}×` : ''}
                            </span>
                            <span className="search-result-location__snippet">{match.snippet}</span>
                          </span>
                        ))}
                        {(searchResultByNoteId.get(note.id)?.matches.length ?? 0) > 4 && (
                          <span className="search-result-location__more">
                            +{(searchResultByNoteId.get(note.id)?.matches.length ?? 0) - 4} ubicaciones más
                          </span>
                        )}
                      </span>
                    )}"""
replacements.append((old_preview_row, new_preview_row))

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Missing NotesWorkspace pattern:\n{old[:180]}')
    text = text.replace(old, new, 1)

workspace.write_text(text)

css = Path('src/features/notes/notes.css')
css_text = css.read_text()
css_append = r'''

/* Global local-search results */
.notes-shell--searching .notes-tabs-shell,
.notes-shell--searching .notes-tag-filter {
  display: none;
}

.search-result-locations {
  min-width: 0;
  display: grid;
  gap: .3rem;
  margin-top: .25rem;
}

.search-result-location {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(5.4rem, auto) minmax(0, 1fr);
  align-items: start;
  gap: .45rem;
  padding: .32rem .42rem;
  border: 1px solid #e3e9f1;
  border-radius: .55rem;
  background: #f8fafc;
  text-align: left;
}

.search-result-location__label {
  color: #315fd4;
  font-size: .66rem;
  font-weight: 850;
  line-height: 1.35;
}

.search-result-location__snippet {
  min-width: 0;
  color: #536273;
  font-size: .7rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.search-result-location__more {
  color: #64748b;
  font-size: .68rem;
  font-weight: 750;
  padding-inline: .15rem;
}

@media (max-width: 520px) {
  .search-result-location {
    grid-template-columns: 1fr;
    gap: .15rem;
  }
}
'''
if '/* Global local-search results */' not in css_text:
    css.write_text(css_text.rstrip() + css_append + '\n')

changelog = Path('docs/CHANGELOG.md')
change_text = changelog.read_text()
marker = '## Unreleased\n'
entry = '- Búsqueda local global: ignora la carpeta/etiqueta activa mientras se busca y muestra carpeta, ubicación, fragmento y cantidad de coincidencias antes de abrir una nota.\n'
if entry not in change_text:
    if marker not in change_text:
        raise SystemExit('Missing changelog marker')
    change_text = change_text.replace(marker, marker + entry, 1)
    changelog.write_text(change_text)
