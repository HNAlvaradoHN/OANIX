import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  FOLDER_COLOR_PRESETS,
  FOLDER_ICON_OPTIONS,
  type FolderIcon,
} from './folderAppearanceCatalog'
import { saveFolderColor, saveFolderIcon } from './folderAppearanceService'
import { loadFolders } from './folderService'
import './folderCreation.css'

const CREATE_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'] as const
const POLL_ATTEMPTS = 36

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (setter) setter.call(input, value)
  else input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function legacyDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.folder-dialog')
}

function closeLegacyDialog() {
  legacyDialog()?.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')?.click()
}

export function FolderCreationRuntime() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(CREATE_COLORS[0] ?? DEFAULT_FOLDER_COLOR)
  const [icon, setIcon] = useState<FolderIcon>(DEFAULT_FOLDER_ICON)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const suppressLegacyOpenRef = useRef(false)

  function resetDraft() {
    setName('')
    setColor(CREATE_COLORS[0] ?? DEFAULT_FOLDER_COLOR)
    setIcon(DEFAULT_FOLDER_ICON)
    setError('')
  }

  function close() {
    suppressLegacyOpenRef.current = true
    setOpen(false)
    closeLegacyDialog()
    window.setTimeout(() => {
      suppressLegacyOpenRef.current = false
    }, 0)
  }

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    root.classList.add('oanix-folder-create-v2')
    body.classList.add('oanix-folder-create-v2')

    const syncLegacyDialog = () => {
      if (!legacyDialog() || suppressLegacyOpenRef.current) return
      setError('')
      setOpen(true)
    }

    const observer = new MutationObserver(syncLegacyDialog)
    observer.observe(document.body, { childList: true, subtree: true })
    syncLegacyDialog()

    const closeBeforeNoteCreation = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.notes-create-fab, .empty-action')) return
      if (!legacyDialog() && !open) return
      suppressLegacyOpenRef.current = true
      setOpen(false)
      closeLegacyDialog()
      window.setTimeout(() => {
        suppressLegacyOpenRef.current = false
      }, 0)
    }

    document.addEventListener('click', closeBeforeNoteCreation, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', closeBeforeNoteCreation, true)
      root.classList.remove('oanix-folder-create-v2')
      body.classList.remove('oanix-folder-create-v2')
    }
  }, [open])

  async function createFromLegacyHandler() {
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

      const dialog = legacyDialog()
      const input = dialog?.querySelector<HTMLInputElement>('.folder-create-row input')
      const createButton = dialog?.querySelector<HTMLButtonElement>('.folder-create-row button')
      if (!dialog || !input || !createButton) {
        throw new Error('No se encontró el creador de carpetas de OANIX.')
      }

      const beforeIds = new Set(before.map((folder) => folder.id))
      setReactInputValue(input, normalizedName)
      await nextFrame()
      createButton.click()

      let created = null as Awaited<ReturnType<typeof loadFolders>>[number] | null
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        const current = await loadFolders()
        created = current.find((folder) => !beforeIds.has(folder.id)) ?? null
        if (created) break
        await delay(55)
      }
      if (!created) throw new Error('La carpeta no terminó de crearse a tiempo.')

      await Promise.all([
        saveFolderColor(created.id, color),
        saveFolderIcon(created.id, icon),
      ])
      window.dispatchEvent(new Event('oanix:local-data-changed'))
      resetDraft()
      close()
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
              if (event.key === 'Enter' && !busy) void createFromLegacyHandler()
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
                style={{ '--oanix-folder-create-color': candidate } as React.CSSProperties}
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
          <button type="button" className="is-primary" onClick={() => void createFromLegacyHandler()} disabled={busy}>
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
