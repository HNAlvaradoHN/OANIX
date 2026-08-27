import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  FOLDER_ICON_OPTIONS,
  type FolderIcon,
} from './folderAppearanceCatalog'
import { saveFolderColor, saveFolderIcon } from './folderAppearanceService'
import { createFolder, loadFolders } from './folderService'
import './folderCreation.css'

const CREATE_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'] as const
const MANAGE_FOLDER_ATTR = 'data-oanix-manage-folder-id'
const CREATE_TRIGGER_SELECTOR = '.notes-tab--add, .oanix-folder-rail__item--add, .oanix-organic-folder-control--add'

function folderManagementActive(): boolean {
  return document.documentElement.hasAttribute(MANAGE_FOLDER_ATTR)
}

export function FolderCreationRuntime() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(CREATE_COLORS[0] ?? DEFAULT_FOLDER_COLOR)
  const [icon, setIcon] = useState<FolderIcon>(DEFAULT_FOLDER_ICON)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function resetDraft() {
    setName('')
    setColor(CREATE_COLORS[0] ?? DEFAULT_FOLDER_COLOR)
    setIcon(DEFAULT_FOLDER_ICON)
    setError('')
  }

  function openCreator() {
    if (folderManagementActive()) return
    setError('')
    setOpen(true)
  }

  function close() {
    if (busy) return
    setOpen(false)
    resetDraft()
  }

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    root.classList.add('oanix-folder-create-v2')
    body.classList.add('oanix-folder-create-v2')

    const handleOpenRequest = () => openCreator()
    const handleVisibleTrigger = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest(CREATE_TRIGGER_SELECTOR)) return
      if (folderManagementActive()) return
      event.preventDefault()
      openCreator()
    }

    window.addEventListener('oanix:open-folder-creator', handleOpenRequest)
    document.addEventListener('click', handleVisibleTrigger, true)
    return () => {
      window.removeEventListener('oanix:open-folder-creator', handleOpenRequest)
      document.removeEventListener('click', handleVisibleTrigger, true)
      root.classList.remove('oanix-folder-create-v2')
      body.classList.remove('oanix-folder-create-v2')
    }
  }, [])

  async function createDirectly() {
    const normalizedName = name.trim().replace(/\s+/g, ' ')
    if (!normalizedName) {
      setError('Escribe un nombre para la carpeta.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const before = await loadFolders()
      if (before.some((folder) => folder.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
        setError('Ya existe una carpeta con ese nombre.')
        return
      }

      const created = await createFolder(normalizedName)
      await Promise.all([
        saveFolderColor(created.id, color),
        saveFolderIcon(created.id, icon),
      ])

      setOpen(false)
      resetDraft()
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', {
        detail: { recordType: 'folder', recordId: created.id },
      }))
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="oanix-folder-create-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget && !busy) close()
    }}>
      <section className="oanix-folder-create" role="dialog" aria-modal="true" aria-label="Nueva carpeta" onPointerDown={(event) => event.stopPropagation()}>
        <header><span aria-hidden="true">📁</span><strong>Nueva carpeta</strong></header>

        <label className="oanix-folder-create__field">
          <span>NOMBRE</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void createDirectly()
            }}
            maxLength={60}
            placeholder="Ej. Proyectos 2026..."
          />
        </label>

        <fieldset>
          <legend>COLOR</legend>
          <div className="oanix-folder-create__colors">
            {CREATE_COLORS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === color ? 'is-selected' : ''}
                style={{ '--oanix-folder-create-color': candidate } as CSSProperties}
                aria-label={`Usar color ${candidate}`}
                onClick={() => setColor(candidate)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>ICONO</legend>
          <div className="oanix-folder-create__icons">
            {FOLDER_ICON_OPTIONS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === icon ? 'is-selected' : ''}
                aria-label={`Usar icono ${candidate}`}
                onClick={() => setIcon(candidate)}
              >
                {candidate}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="oanix-folder-create__error" role="alert">{error}</p>}

        <footer>
          <button type="button" className="is-cancel" onClick={close} disabled={busy}>Cancelar</button>
          <button type="button" className="is-primary" onClick={() => void createDirectly()} disabled={busy}>
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
