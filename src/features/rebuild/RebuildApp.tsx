import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { AccountPanel } from '../account/AccountPanel'
import { OanixIcon } from '../../shared/OanixIcon'
import {
  AUTO_LOCK_OPTIONS,
  readSavedAutoLockMinutes,
  saveAutoLockMinutes,
  type AutoLockMinutes,
} from '../../security/session/autoLockPolicy'
import {
  applyOanixTheme,
  readSavedOanixTheme,
  type OanixThemePreset,
} from '../personalization/themeCatalog'
import {
  createRebuildFolder,
  createRebuildNote,
  createRebuildTag,
  loadRebuildWorkspace,
  readRebuildNote,
  saveRebuildNote,
} from './rebuildService'
import {
  folderGradient,
  folderGradientCss,
  type FolderV2Record,
  type NoteV2Meta,
  type TagV2Record,
} from './rebuildModel'
import './rebuild.css'

interface RebuildAppProps {
  onLock: () => void
}

interface EditorDraft {
  meta: NoteV2Meta
  title: string
  text: string
  dirty: boolean
}

type ViewMode = 'home' | 'recents'
type CreateKind = 'chooser' | 'folder' | 'tag' | null

const dateFormatter = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
})
const timeFormatter = new Intl.DateTimeFormat('es', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatNoteTime(iso: string): string {
  const value = new Date(iso)
  const today = new Date()
  if (
    value.getFullYear() === today.getFullYear()
    && value.getMonth() === today.getMonth()
    && value.getDate() === today.getDate()
  ) {
    return timeFormatter.format(value)
  }
  return dateFormatter.format(value)
}

function useDelayedBusy(active: boolean, delay = 600): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [active, delay])

  return visible
}

function folderStyle(folder: FolderV2Record): CSSProperties {
  const [accent] = folderGradient(folder.gradientIndex)
  return {
    '--folder-accent': accent,
    '--folder-soft': folderGradientCss(folder.gradientIndex, 0.16),
    '--folder-strong': folderGradientCss(folder.gradientIndex),
  } as CSSProperties
}

export function RebuildApp({ onLock }: RebuildAppProps) {
  const [notes, setNotes] = useState<NoteV2Meta[]>([])
  const [folders, setFolders] = useState<FolderV2Record[]>([])
  const [tags, setTags] = useState<TagV2Record[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('home')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createKind, setCreateKind] = useState<CreateKind>(null)
  const [createName, setCreateName] = useState('')
  const [editor, setEditor] = useState<EditorDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [openingNote, setOpeningNote] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<OanixThemePreset['id']>(() => readSavedOanixTheme())
  const [autoLockMinutes, setAutoLockMinutes] = useState<AutoLockMinutes>(() => readSavedAutoLockMinutes())
  const searchRef = useRef<HTMLInputElement | null>(null)

  const showSavingOverlay = useDelayedBusy(saving)
  const showOpeningOverlay = useDelayedBusy(openingNote)

  useEffect(() => {
    let active = true
    void loadRebuildWorkspace()
      .then((snapshot) => {
        if (!active) return
        setNotes(snapshot.notes)
        setFolders(snapshot.folders)
        setTags(snapshot.tags)
        setError('')
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'No se pudo abrir el nuevo espacio de OANIX.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleThemeChange = () => setTheme(readSavedOanixTheme())
    window.addEventListener('oanix:theme-change', handleThemeChange)
    return () => window.removeEventListener('oanix:theme-change', handleThemeChange)
  }, [])

  useEffect(() => {
    if (!editor?.dirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [editor?.dirty])

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  )
  const activeFolder = activeFolderId ? folderById.get(activeFolderId) ?? null : null

  const visibleNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')
    const filtered = notes.filter((note) => {
      if (viewMode === 'home' && activeFolderId && note.folderId !== activeFolderId) return false
      if (activeTagId && !note.tagIds.includes(activeTagId)) return false
      if (normalizedQuery && !note.title.toLocaleLowerCase('es').includes(normalizedQuery)) return false
      return true
    })

    return [...filtered].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  }, [notes, activeFolderId, activeTagId, query, viewMode])

  const mainStyle = activeFolder
    ? ({
        '--active-folder-cover': folderGradientCss(activeFolder.gradientIndex, 0.28),
        '--active-folder-accent': folderGradient(activeFolder.gradientIndex)[0],
      } as CSSProperties)
    : undefined

  function chooseTheme(next: OanixThemePreset['id']) {
    setTheme(applyOanixTheme(next))
  }

  function chooseAutoLock(next: AutoLockMinutes) {
    setAutoLockMinutes(saveAutoLockMinutes(next))
  }

  function focusSearch() {
    setViewMode('home')
    window.requestAnimationFrame(() => searchRef.current?.focus())
  }

  async function openNote(noteId: string) {
    if (openingNote || saving) return
    setOpeningNote(true)
    setError('')
    try {
      const opened = await readRebuildNote(noteId)
      setEditor({
        meta: opened.meta,
        title: opened.meta.title,
        text: opened.body.text,
        dirty: false,
      })
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'No se pudo abrir la nota.')
    } finally {
      setOpeningNote(false)
    }
  }

  async function createNote() {
    if (saving) return
    setError('')
    try {
      const created = await createRebuildNote(activeFolderId)
      setNotes((current) => [created.meta, ...current])
      setEditor({
        meta: created.meta,
        title: created.meta.title,
        text: created.body.text,
        dirty: false,
      })
      setCreateKind(null)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la nota.')
    }
  }

  async function leaveEditor() {
    if (!editor || saving) return

    if (!editor.dirty) {
      setEditor(null)
      return
    }

    setSaving(true)
    setError('')
    try {
      const updated = await saveRebuildNote(editor.meta, editor.title, editor.text)
      setNotes((current) => current.map((note) => note.id === updated.id ? updated : note))
      setEditor(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la nota.')
    } finally {
      setSaving(false)
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (createKind !== 'folder' && createKind !== 'tag') return

    setError('')
    try {
      if (createKind === 'folder') {
        const folder = await createRebuildFolder(createName)
        setFolders((current) => [...current, folder])
        setActiveFolderId(folder.id)
        setViewMode('home')
      } else {
        const tag = await createRebuildTag(createName)
        setTags((current) => [...current, tag].sort((left, right) =>
          left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
        ))
      }
      setCreateName('')
      setCreateKind(null)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el elemento.')
    }
  }

  const shellClass = `rebuild-shell${editor ? ' rebuild-shell--open' : ''}`

  if (loading) {
    return (
      <main className="rebuild-boot" aria-live="polite">
        <span className="rebuild-spinner" aria-hidden="true" />
        <strong>Preparando tu espacio</strong>
        <p>Abriendo el almacenamiento cifrado nuevo de OANIX.</p>
      </main>
    )
  }

  return (
    <main className={shellClass}>
      <section className="rebuild-main" style={mainStyle}>
        <header className="rebuild-topbar">
          <button
            className="rebuild-icon-button"
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir carpetas y etiquetas"
          >
            ☰
          </button>

          <div className="rebuild-brand">
            <span className="rebuild-brand__badge" aria-hidden="true">O</span>
            <span>OANIX</span>
          </div>

          <input
            ref={searchRef}
            className="rebuild-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar notas…"
            aria-label="Buscar notas"
          />

          <div className="rebuild-topbar__spacer" />

          <button className="rebuild-icon-button" type="button" onClick={focusSearch} aria-label="Buscar">
            <OanixIcon name="search" />
          </button>
          <button
            className="rebuild-icon-button"
            type="button"
            onClick={() => chooseTheme(theme === 'classic-night' ? 'classic-day' : 'classic-night')}
            aria-label={theme === 'classic-night' ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
          >
            <OanixIcon name={theme === 'classic-night' ? 'sun' : 'moon'} />
          </button>
          <button
            className="rebuild-icon-button"
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Cuenta de OANIX"
          >
            <OanixIcon name="user" />
          </button>
        </header>

        {viewMode === 'home' ? (
          <nav className="rebuild-folders" aria-label="Carpetas">
            <button
              type="button"
              className={`rebuild-folder-tab${activeFolderId === null ? ' is-active' : ''}`}
              onClick={() => setActiveFolderId(null)}
            >
              <span className="rebuild-folder-tab__icon">✨</span>
              Todas <small>{notes.length}</small>
            </button>
            {folders.map((folder) => {
              const count = notes.filter((note) => note.folderId === folder.id).length
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={`rebuild-folder-tab${activeFolderId === folder.id ? ' is-active' : ''}`}
                  style={folderStyle(folder)}
                  onClick={() => setActiveFolderId(folder.id)}
                >
                  <span className="rebuild-folder-tab__icon">{folder.icon}</span>
                  {folder.name} <small>{count}</small>
                </button>
              )
            })}
          </nav>
        ) : (
          <div className="rebuild-mode-strip">
            <span>🕘 Recientes · últimas notas modificadas</span>
          </div>
        )}

        <div className="rebuild-tags" aria-label="Etiquetas">
          <button
            type="button"
            className={`rebuild-tag${activeTagId === null ? ' is-active' : ''}`}
            onClick={() => setActiveTagId(null)}
          >
            Todas
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`rebuild-tag${activeTagId === tag.id ? ' is-active' : ''}`}
              onClick={() => setActiveTagId((current) => current === tag.id ? null : tag.id)}
            >
              <i style={{ background: tag.color }} aria-hidden="true" />
              {tag.name}
            </button>
          ))}
        </div>

        <section className="rebuild-notes" aria-label="Notas">
          {error && <div className="rebuild-error" role="alert">{error}</div>}
          {visibleNotes.length === 0 ? (
            <div className="rebuild-empty">
              <strong>{query ? 'No encontramos notas' : 'Este espacio está listo'}</strong>
              <p>{query ? 'Prueba con otra búsqueda.' : 'Crea una nota con el botón + para empezar.'}</p>
            </div>
          ) : (
            <div className="rebuild-note-list">
              {visibleNotes.map((note) => {
                const folder = note.folderId ? folderById.get(note.folderId) ?? null : null
                return (
                  <button
                    key={note.id}
                    type="button"
                    className="rebuild-note-row"
                    onClick={() => void openNote(note.id)}
                  >
                    <span
                      className="rebuild-note-row__avatar"
                      style={folder ? folderStyle(folder) : undefined}
                      aria-hidden="true"
                    >
                      {folder?.icon ?? '📝'}
                    </span>
                    <span className="rebuild-note-row__main">
                      <strong>{note.title}</strong>
                      <small>{folder?.name ?? 'Sin carpeta'}</small>
                    </span>
                    <span className="rebuild-note-row__time">{formatNoteTime(note.updatedAt)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <nav className="rebuild-bottom-nav" aria-label="Navegación principal">
          <button
            type="button"
            className={viewMode === 'home' && !query ? 'is-active' : ''}
            onClick={() => {
              setViewMode('home')
              setQuery('')
              setActiveTagId(null)
            }}
          >
            <span>🏠</span>Inicio
          </button>
          <button type="button" className={query ? 'is-active' : ''} onClick={focusSearch}>
            <span>🔍</span>Buscar
          </button>
          <button
            type="button"
            className="rebuild-fab"
            onClick={() => setCreateKind('chooser')}
            aria-label="Crear"
          >
            ＋
          </button>
          <button
            type="button"
            className={viewMode === 'recents' ? 'is-active' : ''}
            onClick={() => {
              setViewMode('recents')
              setActiveFolderId(null)
            }}
          >
            <span>🕘</span>Recientes
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            <span>⚙️</span>Ajustes
          </button>
        </nav>
      </section>

      <aside className={`rebuild-drawer${drawerOpen ? ' is-open' : ''}`} aria-hidden={!drawerOpen}>
        <header>
          <button
            type="button"
            className="rebuild-icon-button"
            onClick={() => setDrawerOpen(false)}
            data-oanix-back-close="true"
            aria-label="Cerrar panel"
          >
            <OanixIcon name="back" />
          </button>
          <strong>OANIX</strong>
          <button
            type="button"
            className="rebuild-icon-button"
            onClick={() => setCreateKind('chooser')}
            aria-label="Crear carpeta o etiqueta"
          >
            <OanixIcon name="plus" />
          </button>
        </header>

        <div className="rebuild-drawer__columns">
          <section>
            <h3>Carpetas <small>{folders.length}</small></h3>
            <div className="rebuild-drawer__list">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="rebuild-drawer__folder"
                  style={folderStyle(folder)}
                  onClick={() => {
                    setActiveFolderId(folder.id)
                    setViewMode('home')
                    setDrawerOpen(false)
                  }}
                >
                  <span>{folder.icon}</span>
                  <strong>{folder.name}</strong>
                </button>
              ))}
              {folders.length === 0 && <p>Sin carpetas todavía.</p>}
            </div>
          </section>

          <section>
            <h3>Etiquetas <small>{tags.length}</small></h3>
            <div className="rebuild-drawer__list">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="rebuild-drawer__tag"
                  onClick={() => {
                    setActiveTagId(tag.id)
                    setDrawerOpen(false)
                  }}
                >
                  <i style={{ background: tag.color }} />
                  <strong>{tag.name}</strong>
                </button>
              ))}
              {tags.length === 0 && <p>Sin etiquetas todavía.</p>}
            </div>
          </section>
        </div>
      </aside>
      {drawerOpen && (
        <button
          className="rebuild-scrim"
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Cerrar panel"
        />
      )}

      {editor && (
        <section
          className="rebuild-editor"
          aria-label="Editor de nota"
          data-oanix-unsaved={editor.dirty ? 'true' : 'false'}
        >
          <header>
            <button
              type="button"
              className="rebuild-icon-button back-button"
              data-oanix-back-close="true"
              data-oanix-save-and-close="true"
              onClick={() => void leaveEditor()}
              aria-label="Guardar y volver"
            >
              <OanixIcon name="back" />
            </button>
            <input
              value={editor.title}
              onChange={(event) => setEditor((current) => current ? {
                ...current,
                title: event.target.value,
                dirty: true,
              } : current)}
              maxLength={160}
              aria-label="Título de la nota"
            />
          </header>
          {error && <div className="rebuild-editor__error" role="alert">{error}</div>}
          <textarea
            className="rebuild-editor__surface"
            value={editor.text}
            onChange={(event) => setEditor((current) => current ? {
              ...current,
              text: event.target.value,
              dirty: true,
            } : current)}
            placeholder="Empieza a escribir…"
            autoFocus
            spellCheck
          />
        </section>
      )}

      {createKind && (
        <div className="rebuild-modal-host" role="presentation">
          <button
            className="rebuild-modal-backdrop"
            type="button"
            onClick={() => {
              setCreateKind(null)
              setCreateName('')
            }}
            data-oanix-back-close="true"
            aria-label="Cerrar"
          />
          <section className="rebuild-modal" role="dialog" aria-modal="true" aria-label="Crear">
            {createKind === 'chooser' ? (
              <>
                <header>
                  <div>
                    <small>NUEVO</small>
                    <strong>¿Qué quieres crear?</strong>
                  </div>
                  <button type="button" onClick={() => setCreateKind(null)} aria-label="Cerrar">×</button>
                </header>
                <div className="rebuild-create-options">
                  <button type="button" onClick={() => void createNote()}>
                    <span>📝</span><strong>Nueva nota</strong><small>Texto cifrado localmente</small>
                  </button>
                  <button type="button" onClick={() => setCreateKind('folder')}>
                    <span>📁</span><strong>Nueva carpeta</strong><small>Con degradado automático</small>
                  </button>
                  <button type="button" onClick={() => setCreateKind('tag')}>
                    <span>🏷️</span><strong>Nueva etiqueta</strong><small>Organiza tus notas</small>
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={(event) => void submitCreate(event)}>
                <header>
                  <div>
                    <small>{createKind === 'folder' ? 'CARPETA' : 'ETIQUETA'}</small>
                    <strong>{createKind === 'folder' ? 'Nueva carpeta' : 'Nueva etiqueta'}</strong>
                  </div>
                  <button type="button" onClick={() => setCreateKind(null)} aria-label="Cerrar">×</button>
                </header>
                <label>
                  <span>Nombre</span>
                  <input
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    autoFocus
                    maxLength={createKind === 'folder' ? 60 : 40}
                  />
                </label>
                <footer>
                  <button type="button" onClick={() => setCreateKind('chooser')}>Volver</button>
                  <button type="submit">Crear</button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="rebuild-modal-host" role="presentation">
          <button
            className="rebuild-modal-backdrop"
            type="button"
            onClick={() => setSettingsOpen(false)}
            data-oanix-back-close="true"
            aria-label="Cerrar ajustes"
          />
          <section className="rebuild-modal" role="dialog" aria-modal="true" aria-label="Ajustes">
            <header>
              <div><small>OANIX</small><strong>Ajustes</strong></div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar">×</button>
            </header>
            <div className="rebuild-settings">
              <strong>Apariencia</strong>
              <div>
                <button
                  type="button"
                  className={theme === 'classic-day' ? 'is-active' : ''}
                  onClick={() => chooseTheme('classic-day')}
                >
                  ☀️ Día
                </button>
                <button
                  type="button"
                  className={theme === 'classic-night' ? 'is-active' : ''}
                  onClick={() => chooseTheme('classic-night')}
                >
                  🌙 Noche
                </button>
              </div>

              <strong>Bloqueo automático</strong>
              <div className="rebuild-auto-lock" role="radiogroup" aria-label="Tiempo de bloqueo automático">
                {AUTO_LOCK_OPTIONS.map((option) => (
                  <button
                    key={option.minutes}
                    type="button"
                    role="radio"
                    aria-checked={autoLockMinutes === option.minutes}
                    className={autoLockMinutes === option.minutes ? 'is-active' : ''}
                    onClick={() => chooseAutoLock(option.minutes)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button className="rebuild-lock-action" type="button" onClick={onLock}>
                <OanixIcon name="lock" /> Bloquear OANIX
              </button>
            </div>
          </section>
        </div>
      )}

      {(showSavingOverlay || showOpeningOverlay) && (
        <section className="rebuild-progress" role="status" aria-live="polite">
          <span className="rebuild-spinner" aria-hidden="true" />
          <strong>{showSavingOverlay ? 'Guardando cambios…' : 'Abriendo nota…'}</strong>
          <p>{showSavingOverlay ? 'Cifrando y confirmando el guardado local.' : 'Descifrando únicamente esta nota.'}</p>
          <span className="rebuild-progress__bar" aria-hidden="true"><i /></span>
        </section>
      )}

      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
    </main>
  )
}
