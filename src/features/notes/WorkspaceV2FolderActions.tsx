import { useRef, useState, type CSSProperties } from 'react'
import {
  FOLDER_COLOR_PRESETS,
  FOLDER_ICON_OPTIONS,
  type FolderIcon,
} from '../folders/folderAppearanceCatalog'
import {
  saveFolderColor,
  saveFolderFavorite,
  saveFolderIcon,
  saveFolderPinned,
  type FolderAppearanceFlags,
} from '../folders/folderAppearanceService'
import {
  prepareFolderCover,
  removeFolderCover,
  saveFolderCover,
} from '../folders/folderCoverService'
import type { FolderRecord } from '../folders/folderTypes'

interface WorkspaceV2FolderActionsProps {
  folder: FolderRecord
  color: string
  icon: FolderIcon
  cover: string
  flags: FolderAppearanceFlags | undefined
  onClose: () => void
  onOpen: () => void
  onRename: (folder: FolderRecord, name: string) => Promise<void>
  onDelete: (folder: FolderRecord) => Promise<void>
}

export function WorkspaceV2FolderActions({
  folder,
  color,
  icon,
  cover,
  flags,
  onClose,
  onOpen,
  onRename,
  onDelete,
}: WorkspaceV2FolderActionsProps) {
  const [mode, setMode] = useState<'menu' | 'rename' | 'appearance'>('menu')
  const [name, setName] = useState(folder.name)
  const [draftColor, setDraftColor] = useState(color)
  const [draftIcon, setDraftIcon] = useState<FolderIcon>(icon)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  async function run(work: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo completar la acción.')
    } finally {
      setBusy(false)
    }
  }

  async function saveRename() {
    const normalized = name.trim().replace(/\s+/g, ' ')
    if (!normalized) {
      setError('El nombre de la carpeta no puede estar vacío.')
      return
    }
    await run(async () => {
      await onRename(folder, normalized)
      onClose()
    })
  }

  async function saveAppearance() {
    await run(async () => {
      await Promise.all([
        saveFolderColor(folder.id, draftColor),
        saveFolderIcon(folder.id, draftIcon),
      ])
      window.dispatchEvent(new CustomEvent('oanix:folder-appearance-saved'))
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
        detail: { recordType: 'folder-appearance', recordId: folder.id },
      }))
      setMode('menu')
    })
  }

  async function togglePinned() {
    const next = !(flags?.pinned === true)
    await run(async () => {
      await saveFolderPinned(folder.id, next)
      window.dispatchEvent(new CustomEvent('oanix:folder-appearance-saved'))
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
        detail: { recordType: 'folder-appearance', recordId: folder.id },
      }))
    })
  }

  async function toggleFavorite() {
    const next = !(flags?.favorite === true)
    await run(async () => {
      await saveFolderFavorite(folder.id, next)
      window.dispatchEvent(new CustomEvent('oanix:folder-appearance-saved'))
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
        detail: { recordType: 'folder-appearance', recordId: folder.id },
      }))
    })
  }

  async function applyCover(file: File | null) {
    if (!file) return
    await run(async () => {
      const dataUrl = await prepareFolderCover(file)
      await saveFolderCover(folder.id, dataUrl)
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
        detail: { recordType: 'folder-cover', recordId: folder.id },
      }))
    })
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  async function clearCover() {
    await run(async () => {
      await removeFolderCover(folder.id)
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
        detail: { recordType: 'folder-cover', recordId: folder.id },
      }))
    })
  }

  return (
    <div
      className="oanix-workspace-v2__modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="oanix-workspace-v2__modal oanix-workspace-v2__folder-actions"
        role="dialog"
        aria-modal="true"
        aria-label={`Opciones de ${folder.name}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>CARPETA</span>
            <strong>{folder.name}</strong>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar">×</button>
        </header>

        <div className="oanix-workspace-v2__folder-preview">
          <span
            className="oanix-workspace-v2__folder-preview-shape"
            style={{ '--v2-folder-color': draftColor } as CSSProperties}
          >
            {cover ? <img src={cover} alt="" /> : draftIcon}
          </span>
          <div>
            <strong>{name || folder.name}</strong>
            <small>
              {flags?.pinned ? '📌 Fijada · ' : ''}
              {flags?.favorite ? '⭐ Favorita' : 'Privada y cifrada'}
            </small>
          </div>
        </div>

        {mode === 'menu' && (
          <div className="oanix-workspace-v2__folder-action-grid">
            <button type="button" onClick={() => { onOpen(); onClose() }} disabled={busy}>↗ Abrir carpeta</button>
            <button type="button" onClick={() => void togglePinned()} disabled={busy}>
              {flags?.pinned ? '📌 Desfijar' : '📌 Fijar'}
            </button>
            <button type="button" onClick={() => void toggleFavorite()} disabled={busy}>
              {flags?.favorite ? '★ Quitar favorita' : '☆ Favorita'}
            </button>
            <button type="button" onClick={() => setMode('rename')} disabled={busy}>✎ Renombrar</button>
            <button type="button" onClick={() => setMode('appearance')} disabled={busy}>🎨 Color / icono</button>
            <button type="button" onClick={() => coverInputRef.current?.click()} disabled={busy}>🖼 {cover ? 'Cambiar imagen' : 'Poner imagen'}</button>
            {cover && <button type="button" onClick={() => void clearCover()} disabled={busy}>⌫ Quitar imagen</button>}
            <button
              type="button"
              className="is-danger"
              onClick={() => void run(async () => {
                await onDelete(folder)
                onClose()
              })}
              disabled={busy}
            >
              🗑 Eliminar carpeta
            </button>
          </div>
        )}

        {mode === 'rename' && (
          <>
            <label className="oanix-workspace-v2__modal-field">
              <span>NOMBRE</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveRename()
                  if (event.key === 'Escape' && !busy) setMode('menu')
                }}
                maxLength={60}
              />
            </label>
            <footer>
              <button type="button" onClick={() => setMode('menu')} disabled={busy}>Atrás</button>
              <button type="button" className="is-primary" onClick={() => void saveRename()} disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </footer>
          </>
        )}

        {mode === 'appearance' && (
          <>
            <fieldset className="oanix-workspace-v2__picker-section">
              <legend>COLOR</legend>
              <div className="oanix-workspace-v2__color-picker">
                {FOLDER_COLOR_PRESETS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={candidate === draftColor ? 'is-selected' : ''}
                    aria-label={`Usar color ${candidate}`}
                    aria-pressed={candidate === draftColor}
                    style={{ '--v2-picker-color': candidate } as CSSProperties}
                    onClick={() => setDraftColor(candidate)}
                    disabled={busy}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="oanix-workspace-v2__picker-section">
              <legend>ICONO</legend>
              <div className="oanix-workspace-v2__icon-picker">
                {FOLDER_ICON_OPTIONS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={candidate === draftIcon ? 'is-selected' : ''}
                    aria-label={`Usar icono ${candidate}`}
                    aria-pressed={candidate === draftIcon}
                    onClick={() => setDraftIcon(candidate)}
                    disabled={busy}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </fieldset>

            <footer>
              <button type="button" onClick={() => setMode('menu')} disabled={busy}>Atrás</button>
              <button type="button" className="is-primary" onClick={() => void saveAppearance()} disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar apariencia'}
              </button>
            </footer>
          </>
        )}

        {error && <p className="oanix-workspace-v2__modal-error" role="alert">{error}</p>}

        <input
          ref={coverInputRef}
          className="oanix-workspace-v2__hidden-file"
          type="file"
          accept="image/*"
          onChange={(event) => void applyCover(event.currentTarget.files?.[0] ?? null)}
        />
      </section>
    </div>
  )
}
