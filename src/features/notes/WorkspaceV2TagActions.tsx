import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { OanixIcon } from '../../shared/OanixIcon'
import {
  DEFAULT_TAG_COLOR,
  DEFAULT_TAG_ICON,
  TAG_COLOR_OPTIONS,
  TAG_ICON_OPTIONS,
  type TagRecord,
} from '../tags/tagTypes'

interface WorkspaceV2TagActionsProps {
  tags: TagRecord[]
  onCreate: (name: string, appearance: { icon: string; color: string }) => Promise<void>
  onDelete: (tag: TagRecord) => Promise<void>
}

type TagDialogKind = 'create' | 'delete'
const TAG_DIALOG_HISTORY_KEY = 'oanixWorkspaceV2TagDialog'

function dialogHistoryValue(kind: TagDialogKind): string {
  return `tag-${kind}`
}

export function WorkspaceV2TagActions({
  tags,
  onCreate,
  onDelete,
}: WorkspaceV2TagActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string>(DEFAULT_TAG_ICON)
  const [color, setColor] = useState<string>(DEFAULT_TAG_COLOR)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function resetCreate() {
    setName('')
    setIcon(DEFAULT_TAG_ICON)
    setColor(DEFAULT_TAG_COLOR)
    setError('')
  }

  function openDialog(kind: TagDialogKind) {
    const current = window.history.state && typeof window.history.state === 'object'
      ? window.history.state as Record<string, unknown>
      : {}
    window.history.pushState({
      ...current,
      [TAG_DIALOG_HISTORY_KEY]: dialogHistoryValue(kind),
    }, '')

    setMenuOpen(false)
    setError('')
    if (kind === 'create') {
      resetCreate()
      setCreateOpen(true)
      setDeleteOpen(false)
    } else {
      setDeleteOpen(true)
      setCreateOpen(false)
    }
  }

  function closeDialog(kind: TagDialogKind) {
    const state = window.history.state && typeof window.history.state === 'object'
      ? window.history.state as Record<string, unknown>
      : {}
    if (state[TAG_DIALOG_HISTORY_KEY] === dialogHistoryValue(kind)) {
      window.history.back()
      return
    }

    if (kind === 'create') {
      setCreateOpen(false)
      resetCreate()
    } else {
      setDeleteOpen(false)
      setError('')
    }
  }

  useEffect(() => {
    function handlePopState() {
      if (createOpen) {
        setCreateOpen(false)
        resetCreate()
        return
      }
      if (deleteOpen) {
        setDeleteOpen(false)
        setError('')
        return
      }
      if (menuOpen) setMenuOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [createOpen, deleteOpen, menuOpen])

  async function createTag() {
    if (busy) return
    const normalized = name.trim().replace(/\s+/g, ' ')
    if (!normalized) {
      setError('Escribe un nombre para la etiqueta.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await onCreate(normalized, { icon, color })
      closeDialog('create')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la etiqueta.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteTag(tag: TagRecord) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onDelete(tag)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la etiqueta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="oanix-workspace-v2__tag-actions-root">
      <button
        type="button"
        className="oanix-workspace-v2__chip-add"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Opciones de etiquetas"
        title="Etiquetas"
        aria-expanded={menuOpen}
        data-v2-drag-ignore="true"
      >
        <OanixIcon name="plus" size={19} />
      </button>

      {menuOpen && (
        <div className="oanix-workspace-v2__tag-actions-menu" role="menu" aria-label="Acciones de etiquetas">
          <button type="button" role="menuitem" onClick={() => openDialog('create')}>
            Agregar etiqueta
          </button>
          <button type="button" role="menuitem" onClick={() => openDialog('delete')}>
            Eliminar etiqueta
          </button>
        </div>
      )}

      {createOpen && createPortal(
        <div
          className="oanix-workspace-v2__modal-backdrop oanix-workspace-v2__modal-backdrop--tag"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && !busy) closeDialog('create')
          }}
        >
          <section
            className="oanix-workspace-v2__modal oanix-workspace-v2__modal--tag"
            role="dialog"
            aria-modal="true"
            aria-label="Nueva etiqueta"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div><span>ETIQUETA</span><strong>Nueva etiqueta</strong></div>
              <button type="button" onClick={() => closeDialog('create')} disabled={busy} aria-label="Cerrar">
                <OanixIcon name="close" size={17} />
              </button>
            </header>

            <label className="oanix-workspace-v2__modal-field">
              <span>NOMBRE</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void createTag()
                  if (event.key === 'Escape' && !busy) closeDialog('create')
                }}
                maxLength={40}
                placeholder="Ej. Proyectos 2026"
              />
            </label>

            <fieldset className="oanix-workspace-v2__picker-section">
              <legend>ICONO</legend>
              <div className="oanix-workspace-v2__icon-picker">
                {TAG_ICON_OPTIONS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={candidate === icon ? 'is-selected' : ''}
                    aria-label={`Usar icono ${candidate}`}
                    aria-pressed={candidate === icon}
                    onClick={() => setIcon(candidate)}
                    disabled={busy}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="oanix-workspace-v2__picker-section">
              <legend>COLOR</legend>
              <div className="oanix-workspace-v2__color-picker">
                {TAG_COLOR_OPTIONS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={candidate === color ? 'is-selected' : ''}
                    aria-label={`Usar color ${candidate}`}
                    aria-pressed={candidate === color}
                    style={{ '--v2-picker-color': candidate } as CSSProperties}
                    onClick={() => setColor(candidate)}
                    disabled={busy}
                  />
                ))}
              </div>
            </fieldset>

            {error && <p className="oanix-workspace-v2__modal-error" role="alert">{error}</p>}

            <footer>
              <button type="button" onClick={() => closeDialog('create')} disabled={busy}>Cancelar</button>
              <button type="button" className="is-primary" onClick={() => void createTag()} disabled={busy}>
                {busy ? 'Creando…' : 'Crear'}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}

      {deleteOpen && createPortal(
        <div
          className="oanix-workspace-v2__modal-backdrop oanix-workspace-v2__modal-backdrop--tag"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && !busy) closeDialog('delete')
          }}
        >
          <section
            className="oanix-workspace-v2__modal oanix-workspace-v2__modal--delete-tags oanix-workspace-v2__modal--tag"
            role="dialog"
            aria-modal="true"
            aria-label="Eliminar etiqueta"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div><span>ETIQUETAS</span><strong>Eliminar etiqueta</strong></div>
              <button type="button" onClick={() => closeDialog('delete')} disabled={busy} aria-label="Cerrar">
                <OanixIcon name="close" size={17} />
              </button>
            </header>

            <div className="oanix-workspace-v2__delete-tag-list">
              {tags.length === 0 ? (
                <p>No hay etiquetas para eliminar.</p>
              ) : tags.map((tag) => (
                <div key={tag.id} className="oanix-workspace-v2__delete-tag-row">
                  <span
                    className="oanix-workspace-v2__delete-tag-icon"
                    style={{ '--v2-tag-color': tag.color ?? DEFAULT_TAG_COLOR } as CSSProperties}
                  >
                    {tag.icon ?? DEFAULT_TAG_ICON}
                  </span>
                  <strong>{tag.name}</strong>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => void deleteTag(tag)}
                    disabled={busy}
                    aria-label={`Eliminar etiqueta ${tag.name}`}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>

            {error && <p className="oanix-workspace-v2__modal-error" role="alert">{error}</p>}

            <footer>
              <button type="button" className="is-primary" onClick={() => closeDialog('delete')} disabled={busy}>Listo</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}
