import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  FOLDER_COLOR_PRESETS,
  FOLDER_ICON_OPTIONS,
  type FolderIcon,
} from '../folders/folderAppearanceCatalog'
import { OanixIcon } from '../../shared/OanixIcon'

const CREATE_COLORS = FOLDER_COLOR_PRESETS.slice(6, 22)

interface WorkspaceV2FolderCreatorProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, appearance: { icon: FolderIcon; color: string }) => Promise<void>
}

export function WorkspaceV2FolderCreator({
  open,
  onClose,
  onCreate,
}: WorkspaceV2FolderCreatorProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(CREATE_COLORS[4] ?? DEFAULT_FOLDER_COLOR)
  const [icon, setIcon] = useState<FolderIcon>(DEFAULT_FOLDER_ICON)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setName('')
    setColor(CREATE_COLORS[4] ?? DEFAULT_FOLDER_COLOR)
    setIcon(DEFAULT_FOLDER_ICON)
    setError('')
  }

  function close() {
    if (busy) return
    reset()
    onClose()
  }

  async function create() {
    if (busy) return
    const normalized = name.trim().replace(/\s+/g, ' ')
    if (!normalized) {
      setError('Escribe un nombre para la carpeta.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await onCreate(normalized, { icon, color })
      reset()
      onClose()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className="oanix-workspace-v2__modal-backdrop oanix-workspace-v2__folder-create-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) close()
      }}
    >
      <section
        className="oanix-workspace-v2__modal oanix-workspace-v2__folder-creator"
        role="dialog"
        aria-modal="true"
        aria-label="Nueva carpeta"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>CARPETA</span>
            <strong>Nueva carpeta</strong>
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label="Cerrar">
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
              if (event.key === 'Enter' && !busy) void create()
              if (event.key === 'Escape' && !busy) close()
            }}
            maxLength={60}
            placeholder="Ej. Proyectos 2026"
          />
        </label>

        <fieldset className="oanix-workspace-v2__picker-section">
          <legend>COLOR</legend>
          <div className="oanix-workspace-v2__color-picker oanix-workspace-v2__color-picker--folders">
            {CREATE_COLORS.map((candidate) => (
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

        <fieldset className="oanix-workspace-v2__picker-section">
          <legend>ICONO</legend>
          <div className="oanix-workspace-v2__icon-picker oanix-workspace-v2__icon-picker--folders">
            {FOLDER_ICON_OPTIONS.slice(0, 30).map((candidate) => (
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

        {error && <p className="oanix-workspace-v2__modal-error" role="alert">{error}</p>}

        <footer>
          <button type="button" onClick={close} disabled={busy}>Cancelar</button>
          <button type="button" className="is-primary" onClick={() => void create()} disabled={busy}>
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
