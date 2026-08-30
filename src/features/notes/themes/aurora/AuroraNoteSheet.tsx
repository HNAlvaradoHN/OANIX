import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { OanixIcon } from '../../../../shared/OanixIcon'
import { noteBlocksToPlainText } from '../../noteTypes'
import type { NoteSheetThemeProps } from '../../noteSheetThemeContract'
import './auroraNoteSheet.css'

type ThemeName = 'claro' | 'sepia' | 'noche'
type AccentName = 'vermellon' | 'oceano' | 'bosque' | 'lavanda' | 'dorado'
type DesignName = 'liso' | 'renglones' | 'puntos' | 'cuadricula'
type FontName = 'serif' | 'sans' | 'mono'

interface SheetThemeState {
  theme: ThemeName
  accent: AccentName
  design: DesignName
  font: FontName
}

interface NoteSheetCommand {
  noteId: string
  command: string
  value?: string | number | boolean
  blockId?: string
}

const ACCENTS: Record<AccentName, string> = {
  vermellon: '#D9542B',
  oceano: '#2E7FB0',
  bosque: '#3E7C4F',
  lavanda: '#7B5EA7',
  dorado: '#B07D2B',
}

const THEME_VARS: Record<ThemeName, Record<string, string>> = {
  claro: {
    '--aurora-paper': '#F6F3EC',
    '--aurora-paper2': '#EFEAE0',
    '--aurora-card': '#FFFDF7',
    '--aurora-ink': '#221E19',
    '--aurora-ink-soft': '#6B6357',
    '--aurora-ink-faint': '#A79C8B',
    '--aurora-line': '#E3DCCC',
    '--aurora-line2': '#D6CDB8',
    '--aurora-code-bg': '#20242E',
    '--aurora-code-head': '#272C38',
    '--aurora-code-ink': '#D7D9E0',
  },
  sepia: {
    '--aurora-paper': '#F3EADA',
    '--aurora-paper2': '#EBDFC8',
    '--aurora-card': '#FBF5E8',
    '--aurora-ink': '#3A2E1E',
    '--aurora-ink-soft': '#7A6A50',
    '--aurora-ink-faint': '#AE9C7E',
    '--aurora-line': '#E2D3B4',
    '--aurora-line2': '#C9B48D',
    '--aurora-code-bg': '#2C2418',
    '--aurora-code-head': '#382E1F',
    '--aurora-code-ink': '#E5D9BF',
  },
  noche: {
    '--aurora-paper': '#181A20',
    '--aurora-paper2': '#20232B',
    '--aurora-card': '#232630',
    '--aurora-ink': '#EDEAE2',
    '--aurora-ink-soft': '#A9A598',
    '--aurora-ink-faint': '#8B877C',
    '--aurora-line': '#30343F',
    '--aurora-line2': '#4A5060',
    '--aurora-code-bg': '#101218',
    '--aurora-code-head': '#171A22',
    '--aurora-code-ink': '#D7D9E0',
  },
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function darken(hex: string, factor = 0.3): string {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  const channels = [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ].map((channel) => Math.max(0, Math.round(channel * (1 - factor))))
  return `rgb(${channels.join(', ')})`
}

function command(detail: NoteSheetCommand) {
  window.dispatchEvent(new CustomEvent('oanix:note-sheet-command', { detail }))
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-HN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

function closestEditorSelectionRect(root: HTMLElement): DOMRect | null {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  const ancestor = range.commonAncestorContainer
  const editorHost = root.querySelector<HTMLElement>('[data-aurora-editor-host="true"]')
  if (!editorHost || !editorHost.contains(ancestor)) return null

  const element = ancestor instanceof Element ? ancestor : ancestor.parentElement
  if (element?.closest('[data-editor-atomic-block], input, textarea, select')) return null

  const rect = range.getBoundingClientRect()
  return rect.width || rect.height ? rect : null
}

export function AuroraNoteSheet({
  note,
  folders,
  tags,
  draftTitle,
  saveLabel,
  savingTitle,
  deleting,
  error,
  editor,
  onBack,
  onDraftTitleChange,
  onCommitTitle,
  onTogglePinned,
  onAddTag,
  onRemoveTag,
  onRenameTag,
  onMoveToFolder,
  onDeleteNote,
  onRetrySave,
}: NoteSheetThemeProps) {
  const rootRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSection, setDrawerSection] = useState<'tags' | 'folder' | 'info'>('tags')
  const [themeOpen, setThemeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [tagValue, setTagValue] = useState('')
  const [themeState, setThemeState] = useState<SheetThemeState>({
    theme: 'claro',
    accent: 'vermellon',
    design: 'liso',
    font: 'serif',
  })

  const noteTags = useMemo(
    () => tags.filter((tag) => (note.tagIds ?? []).includes(tag.id)),
    [tags, note.tagIds],
  )
  const currentFolder = useMemo(
    () => folders.find((folder) => folder.id === note.folderId) ?? null,
    [folders, note.folderId],
  )
  const plainText = useMemo(
    () => noteBlocksToPlainText(note.content.blocks),
    [note.content.blocks],
  )

  const themeStyle = useMemo(() => {
    const accent = ACCENTS[themeState.accent]
    return {
      ...THEME_VARS[themeState.theme],
      '--aurora-acc': accent,
      '--aurora-acc-deep': darken(accent),
      '--aurora-acc-soft': hexToRgba(accent, 0.16),
    } as CSSProperties
  }, [themeState])

  useEffect(() => {
    const title = titleRef.current
    if (!title || document.activeElement === title) return
    if (title.textContent !== draftTitle) title.textContent = draftTitle
  }, [draftTitle, note.id])

  useEffect(() => {
    const root = rootRef.current
    const bubble = bubbleRef.current
    if (!root || !bubble) return

    const update = () => {
      const rect = closestEditorSelectionRect(root)
      if (!rect) {
        bubble.classList.remove('show')
        return
      }

      bubble.classList.add('show')
      const bubbleRect = bubble.getBoundingClientRect()
      let top = rect.top - bubbleRect.height - 12
      if (top < 66) top = rect.bottom + 12
      const left = Math.min(
        Math.max(8, rect.left + rect.width / 2 - bubbleRect.width / 2),
        window.innerWidth - bubbleRect.width - 8,
      )
      bubble.style.top = `${Math.round(top)}px`
      bubble.style.left = `${Math.round(left)}px`
    }

    document.addEventListener('selectionchange', update)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [note.id])

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMoreOpen(false)
      setInsertOpen(false)
      setDrawerOpen(false)
      setThemeOpen(false)
      setDeleteOpen(false)
      setLinkOpen(false)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [])

  function runEditorCommand(commandName: string, value?: string | number | boolean) {
    command({ noteId: note.id, command: commandName, value })
    setInsertOpen(false)
  }

  async function submitTag(event: FormEvent) {
    event.preventDefault()
    const value = tagValue.trim().replace(/^#/, '')
    if (!value) return
    await onAddTag(value)
    setTagValue('')
  }

  function titleKeyDown(event: KeyboardEvent<HTMLHeadingElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    event.currentTarget.blur()
  }

  function openDrawer(section: 'tags' | 'folder' | 'info') {
    setDrawerSection(section)
    setDrawerOpen(true)
    setMoreOpen(false)
  }

  const createdLabel = formatDateTime(note.createdAt)
  const minutes = readingMinutes(plainText)

  return (
    <section
      ref={rootRef}
      className={`aurora-note-sheet aurora-note-sheet--${themeState.theme} aurora-note-sheet--bg-${themeState.design} aurora-note-sheet--font-${themeState.font}`}
      style={themeStyle}
      data-note-sheet-theme="aurora"
      data-note-id={note.id}
    >
      <div className="aurora-grain" aria-hidden="true" />

      <header className="aurora-topbar">
        <button className="aurora-icon-btn" type="button" title="Volver a la lista de notas" onClick={onBack}>
          <OanixIcon name="back" />
        </button>
        <div className="aurora-brand"><b>✳</b><span>Bitácora</span></div>
        <div className="aurora-tb-right">
          <button
            className={`aurora-icon-btn${note.pinned ? ' on' : ''}`}
            type="button"
            title={note.pinned ? 'Desfijar nota' : 'Fijar nota'}
            onClick={onTogglePinned}
          >
            <OanixIcon name="pin" />
          </button>
          <span className="aurora-tb-sep" />
          <button className="aurora-icon-btn" type="button" title="Deshacer" onClick={() => runEditorCommand('undo')}>↶</button>
          <button className="aurora-icon-btn" type="button" title="Rehacer" onClick={() => runEditorCommand('redo')}>↷</button>
          <span className="aurora-tb-sep" />
          <button className="aurora-icon-btn" type="button" title="Personalizar hoja" onClick={() => setThemeOpen(true)}>
            <OanixIcon name="palette" />
          </button>
          <button
            className="aurora-icon-btn"
            type="button"
            title="Acciones de la nota"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <OanixIcon name="menu" />
          </button>
        </div>
      </header>

      {moreOpen && (
        <div className="aurora-pop aurora-more-menu">
          <button className="aurora-mm-item" type="button" onClick={onTogglePinned}>
            <OanixIcon name="pin" /><span>{note.pinned ? 'Desfijar nota' : 'Fijar nota'}</span>
          </button>
          <button className="aurora-mm-item" type="button" onClick={() => openDrawer('tags')}>
            <OanixIcon name="tag" /><span>Editar etiquetas</span>
          </button>
          <button className="aurora-mm-item" type="button" onClick={() => openDrawer('folder')}>
            <OanixIcon name="folder" /><span>Mover a carpeta</span>
          </button>
          <button className="aurora-mm-item" type="button" onClick={() => openDrawer('info')}>
            <OanixIcon name="info" /><span>Ver información</span>
          </button>
          <div className="aurora-mm-sep" />
          <button className="aurora-mm-item danger" type="button" onClick={() => { setMoreOpen(false); setDeleteOpen(true) }}>
            <OanixIcon name="trash" /><span>Eliminar nota</span>
          </button>
        </div>
      )}

      <main className="aurora-page">
        <div className="aurora-canvas">
          <div className="aurora-note-meta">
            <button className="aurora-meta-chip" type="button" onClick={() => openDrawer('folder')}>
              <OanixIcon name="folder" size={13} />
              <span>{currentFolder?.name ?? 'Sin carpeta'}</span>
            </button>
            <span className="aurora-meta-dot">·</span>
            <span>{createdLabel}</span>
            <span className="aurora-meta-dot">·</span>
            <span>{minutes} min</span>
            {note.pinned && (
              <span className="aurora-meta-chip aurora-pin-badge"><OanixIcon name="pin" size={13} />Fijada</span>
            )}
            <span className={`aurora-save${error ? ' error' : ''}`}>
              <i />{deleting ? 'Eliminando…' : saveLabel}
            </span>
          </div>

          <h1
            ref={titleRef}
            className="aurora-note-title"
            contentEditable={!savingTitle}
            suppressContentEditableWarning
            spellCheck={false}
            data-ph="Título de la nota…"
            onInput={(event) => onDraftTitleChange(event.currentTarget.textContent ?? '')}
            onBlur={onCommitTitle}
            onKeyDown={titleKeyDown}
          />

          <div className="aurora-tagline">
            {noteTags.map((tag) => (
              <span className="aurora-tag" key={tag.id}>
                <span className="tx">#{tag.name}</span>
                <button type="button" title={`Quitar etiqueta ${tag.name}`} onClick={() => void onRemoveTag(tag.id)}>
                  <OanixIcon name="close" size={11} />
                </button>
              </span>
            ))}
            <form className="aurora-tag-add" onSubmit={(event) => void submitTag(event)}>
              <input
                value={tagValue}
                onChange={(event) => setTagValue(event.target.value)}
                placeholder="+ añadir etiqueta"
                autoComplete="off"
              />
              <button className="aurora-icon-btn" type="submit" title="Añadir etiqueta">
                <OanixIcon name="plus" size={13} />
              </button>
            </form>
          </div>

          {error && (
            <div className="aurora-save-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={onRetrySave}>Reintentar</button>
            </div>
          )}

          <div className="aurora-editor-host" data-aurora-editor-host="true">
            {editor}
          </div>

          <div className="aurora-canvas-tail" aria-hidden="true" />
        </div>
      </main>

      <button className="aurora-fab" type="button" onClick={() => setInsertOpen((open) => !open)}>
        <OanixIcon name="plus" size={17} />Añadir bloque
      </button>

      {insertOpen && (
        <div className="aurora-pop aurora-insert-menu">
          <div className="aurora-im-group">Contenido</div>
          {[
            ['insert-dailyEntry', '◷', 'Entrada diaria', ''],
            ['insert-image', '▧', 'Imagen', 'Galería o portapapeles'],
            ['insert-file', '⌕', 'Archivos', 'Docs, videos, .apk…'],
            ['insert-code', '</>', 'Código', ''],
            ['insert-checklist', '☑', 'Checklist', ''],
            ['insert-contact', '◉', 'Contacto', ''],
            ['insert-divider', '—', 'Separador', ''],
          ].map(([cmd, icon, label, detail]) => (
            <button
              className="aurora-im-item"
              type="button"
              key={cmd}
              onClick={() => {
                if (cmd === 'insert-file') {
                  window.dispatchEvent(new CustomEvent('oanix:note-sheet-attachment-request', { detail: { noteId: note.id } }))
                  setInsertOpen(false)
                } else {
                  runEditorCommand(cmd)
                }
              }}
            >
              <span className="aurora-im-ico">{icon}</span>
              <span><b>{label}</b>{detail && <small>{detail}</small>}</span>
            </button>
          ))}
          <div className="aurora-im-group">Texto</div>
          {[
            ['format-paragraph', '¶', 'Párrafo'],
            ['format-heading2', 'H2', 'H2'],
            ['format-heading3', 'H3', 'H3'],
            ['format-quote', '❝', 'Cita'],
            ['format-bulletList', '•', 'Lista'],
            ['format-orderedList', '1.', 'Lista num.'],
          ].map(([cmd, icon, label]) => (
            <button className="aurora-im-item" type="button" key={cmd} onClick={() => runEditorCommand(cmd)}>
              <span className="aurora-im-ico">{icon}</span><span><b>{label}</b></span>
            </button>
          ))}
        </div>
      )}

      <div ref={bubbleRef} className={`aurora-bubble${linkOpen ? ' link-open' : ''}`}>
        <button type="button" title="Negrita" onMouseDown={(e) => e.preventDefault()} onClick={() => runEditorCommand('format-bold')}><b>B</b></button>
        <button type="button" title="Cursiva" onMouseDown={(e) => e.preventDefault()} onClick={() => runEditorCommand('format-italic')}><i>I</i></button>
        <span className="aurora-b-sep" />
        <button type="button" title="Párrafo" onMouseDown={(e) => e.preventDefault()} onClick={() => runEditorCommand('format-paragraph')}>¶</button>
        <button type="button" title="H2" onMouseDown={(e) => e.preventDefault()} onClick={() => runEditorCommand('format-heading2')}>H2</button>
        <button type="button" title="H3" onMouseDown={(e) => e.preventDefault()} onClick={() => runEditorCommand('format-heading3')}>H3</button>
        <button type="button" title="Cita" onMouseDown={(e) => e.preventDefault()} onClick={() => runEditorCommand('format-quote')}>❝</button>
        <span className="aurora-b-sep" />
        <button type="button" title="Lista" onMouseDown={(e) => e.preventDefault()} onClick={() => runEditorCommand('format-bulletList')}>•</button>
        <button type="button" title="Lista num." onMouseDown={(e) => e.preventDefault()} onClick={() => runEditorCommand('format-orderedList')}>1.</button>
        <span className="aurora-b-sep" />
        <button
          type="button"
          title="Enlace"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setLinkOpen((open) => !open)}
        >↗</button>
        {linkOpen && (
          <div className="aurora-b-link">
            <input value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://…" />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const value = linkValue.trim()
                if (!value) return
                runEditorCommand('format-link', value)
                setLinkValue('')
                setLinkOpen(false)
              }}
            >Añadir</button>
          </div>
        )}
      </div>

      {(drawerOpen || themeOpen || deleteOpen) && (
        <button
          className="aurora-scrim show"
          type="button"
          aria-label="Cerrar"
          onClick={() => { setDrawerOpen(false); setThemeOpen(false); setDeleteOpen(false) }}
        />
      )}

      <aside className={`aurora-drawer${drawerOpen ? ' open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="aurora-dr-head">
          <div><span className="aurora-dr-eyebrow">Detalles</span><h2>Esta nota</h2></div>
          <button className="aurora-icon-btn" type="button" onClick={() => setDrawerOpen(false)}><OanixIcon name="close" /></button>
        </div>
        <div className="aurora-dr-scroll">
          <section className={drawerSection === 'tags' ? 'flash' : ''}>
            <h4><OanixIcon name="tag" size={14} />Etiquetas</h4>
            {noteTags.map((tag) => (
              <div className="aurora-dr-tag-row" key={tag.id}>
                <input
                  defaultValue={tag.name}
                  onBlur={(event) => {
                    const value = event.currentTarget.value.trim()
                    if (value && value !== tag.name) void onRenameTag(tag.id, value)
                  }}
                />
                <button type="button" onClick={() => void onRemoveTag(tag.id)}><OanixIcon name="close" size={14} /></button>
              </div>
            ))}
            <form className="aurora-dr-add" onSubmit={(event) => void submitTag(event)}>
              <input value={tagValue} onChange={(event) => setTagValue(event.target.value)} placeholder="Nueva etiqueta…" />
              <button type="submit"><OanixIcon name="plus" size={14} />Añadir</button>
            </form>
          </section>

          <section className={drawerSection === 'folder' ? 'flash' : ''}>
            <h4><OanixIcon name="folder" size={14} />Carpeta</h4>
            {folders.map((folder) => (
              <button
                className={`aurora-f-row${note.folderId === folder.id ? ' active' : ''}`}
                type="button"
                key={folder.id}
                onClick={() => void onMoveToFolder(folder.id)}
              >
                <OanixIcon name="folder" size={16} /><span>{folder.name}</span>
                {note.folderId === folder.id && <OanixIcon name="check" size={16} />}
              </button>
            ))}
          </section>

          <section className={drawerSection === 'info' ? 'flash' : ''}>
            <h4><OanixIcon name="info" size={14} />Información</h4>
            <dl>
              <div className="aurora-info-row"><dt>Palabras</dt><dd>{plainText.trim().split(/\s+/).filter(Boolean).length}</dd></div>
              <div className="aurora-info-row"><dt>Caracteres</dt><dd>{plainText.length}</dd></div>
              <div className="aurora-info-row"><dt>Bloques</dt><dd>{note.content.blocks.length}</dd></div>
              <div className="aurora-info-row"><dt>Etiquetas</dt><dd>{noteTags.length}</dd></div>
            </dl>
          </section>
        </div>
      </aside>

      {themeOpen && (
        <div className="aurora-modal open">
          <h3>Personalizar hoja</h3>
          <p className="aurora-m-sub">Demostrativo, sin persistencia.</p>
          <div className="aurora-pt-section">
            <div className="aurora-pt-label">Tema</div>
            <div className="aurora-pt-row">
              {(['claro', 'sepia', 'noche'] as ThemeName[]).map((name) => (
                <button
                  className={`aurora-pt-opt${themeState.theme === name ? ' active' : ''}`}
                  type="button"
                  key={name}
                  onClick={() => setThemeState((state) => ({ ...state, theme: name }))}
                >{name === 'claro' ? 'Claro' : name === 'sepia' ? 'Sepia' : 'Noche'}</button>
              ))}
            </div>
          </div>
          <div className="aurora-pt-section">
            <div className="aurora-pt-label">Acento</div>
            <div className="aurora-pt-row">
              {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
                <button
                  className={`aurora-pt-opt aurora-accent-dot${themeState.accent === name ? ' active' : ''}`}
                  type="button"
                  key={name}
                  style={{ '--dot': ACCENTS[name] } as CSSProperties}
                  aria-label={name}
                  onClick={() => setThemeState((state) => ({ ...state, accent: name }))}
                />
              ))}
            </div>
          </div>
          <div className="aurora-pt-section">
            <div className="aurora-pt-label">Fondo</div>
            <div className="aurora-pt-row">
              {(['liso', 'renglones', 'puntos', 'cuadricula'] as DesignName[]).map((name) => (
                <button
                  className={`aurora-pt-opt${themeState.design === name ? ' active' : ''}`}
                  type="button"
                  key={name}
                  onClick={() => setThemeState((state) => ({ ...state, design: name }))}
                >{name === 'cuadricula' ? 'Cuadrícula' : name[0].toUpperCase() + name.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="aurora-pt-section">
            <div className="aurora-pt-label">Tipografía</div>
            <div className="aurora-pt-row">
              {(['serif', 'sans', 'mono'] as FontName[]).map((name) => (
                <button
                  className={`aurora-pt-opt${themeState.font === name ? ' active' : ''}`}
                  type="button"
                  key={name}
                  onClick={() => setThemeState((state) => ({ ...state, font: name }))}
                >{name === 'serif' ? 'Serif' : name === 'sans' ? 'Sans' : 'Mono'}</button>
              ))}
            </div>
          </div>
          <div className="aurora-m-actions"><button className="aurora-btn primary" type="button" onClick={() => setThemeOpen(false)}>Listo</button></div>
        </div>
      )}

      {deleteOpen && (
        <div className="aurora-modal open">
          <h3>Eliminar nota</h3>
          <p>Se eliminará «<b>{note.title}</b>».</p>
          <div className="aurora-m-actions">
            <button className="aurora-btn ghost" type="button" onClick={() => setDeleteOpen(false)}>Cancelar</button>
            <button className="aurora-btn danger" type="button" onClick={() => { setDeleteOpen(false); onDeleteNote() }}>Eliminar</button>
          </div>
        </div>
      )}
    </section>
  )
}
