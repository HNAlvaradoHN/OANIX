import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes, moveNoteToFolder } from '../notes/noteService'
import { deleteFolder, renameFolder } from './folderService'
import './folderScopedManager.css'

interface ManagedFolder {
  id: string
  name: string
}

interface ManagerTarget {
  folder: ManagedFolder
  closeCustomizer?: () => void
}

function managerTarget(target: EventTarget | null): ManagerTarget | null {
  if (!(target instanceof Element)) return null

  const customizerButton = target.closest<HTMLButtonElement>('.oanix-folder-customizer__actions button')
  if (customizerButton?.textContent?.includes('Administrar nombre')) {
    const customizer = customizerButton.closest<HTMLElement>('.oanix-folder-customizer[data-oanix-folder-id]')
    const id = customizer?.dataset.oanixFolderId
    const name = customizer?.querySelector<HTMLElement>('#oanix-folder-customizer-title')?.textContent?.trim()
    if (!id || !name) return null

    return {
      folder: { id, name },
      closeCustomizer: () => {
        const actions = customizerButton.closest<HTMLElement>('.oanix-folder-customizer__actions')
        const cancel = Array.from(actions?.children ?? [])
          .filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
          .find((candidate) => candidate.textContent?.trim() === 'Cancelar')
        window.requestAnimationFrame(() => cancel?.click())
      },
    }
  }

  const focusButton = target.closest<HTMLButtonElement>('.oanix-folder-focus__actions button')
  if (focusButton?.textContent?.includes('Nombre')) {
    const focus = focusButton.closest<HTMLElement>('.oanix-folder-focus[data-oanix-folder-id]')
    const id = focus?.dataset.oanixFolderId
    const name = focus?.querySelector<HTMLElement>('.oanix-folder-focus__details h2')?.textContent?.trim()
    if (id && name) return { folder: { id, name } }
  }

  return null
}

export function FolderScopedManagerRuntime() {
  const [managed, setManaged] = useState<ManagedFolder | null>(null)
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const target = managerTarget(event.target)
      if (!target) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      target.closeCustomizer?.()
      setManaged(target.folder)
      setDraftName(target.folder.name)
      setError('')
    }

    document.addEventListener('click', intercept, true)
    return () => document.removeEventListener('click', intercept, true)
  }, [])

  async function saveName() {
    if (!managed || busy) return
    const name = draftName.trim().replace(/\s+/g, ' ')
    if (!name) {
      setError('El nombre de la carpeta no puede estar vacío.')
      return
    }
    if (name === managed.name) {
      setManaged(null)
      return
    }

    setBusy(true)
    setError('')
    try {
      await renameFolder(managed.id, name)
      setManaged(null)
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'folder' } }))
      window.dispatchEvent(new Event('oanix:workspace-refresh'))
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'No se pudo renombrar la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  async function removeFolder() {
    if (!managed || busy) return

    let notes: Awaited<ReturnType<typeof loadNotes>>
    try {
      notes = await loadNotes()
    } catch {
      setError('No se pudieron comprobar las notas de esta carpeta.')
      return
    }

    const affected = notes.filter((note) => note.folderId === managed.id)
    const detail = affected.length === 0
      ? 'La carpeta no contiene notas.'
      : `${affected.length} nota${affected.length === 1 ? '' : 's'} volverá${affected.length === 1 ? '' : 'n'} a “Sin carpeta”.`
    if (!window.confirm(`¿Eliminar la carpeta “${managed.name}”?\n\n${detail}\n\nLas notas NO se eliminarán.`)) return

    setBusy(true)
    setError('')
    try {
      for (const note of affected) await moveNoteToFolder(note.id, null)
      await deleteFolder(managed.id)
      setManaged(null)
      window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'folder' } }))
      window.dispatchEvent(new Event('oanix:workspace-refresh'))
    } catch {
      setError('No se pudo completar la eliminación de la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  if (!managed) return null

  return createPortal(
    <div className="oanix-folder-scoped-manager-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget && !busy) setManaged(null)
    }}>
      <section className="oanix-folder-scoped-manager" role="dialog" aria-modal="true" aria-label={`Administrar ${managed.name}`} onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>CARPETA</span><strong>{managed.name}</strong></div>
          <button type="button" onClick={() => setManaged(null)} disabled={busy} aria-label="Cerrar">×</button>
        </header>

        <label>
          <span>NOMBRE</span>
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void saveName()
            }}
            maxLength={60}
          />
        </label>

        {error && <p role="alert">{error}</p>}

        <div className="oanix-folder-scoped-manager__actions">
          <button type="button" className="is-danger" onClick={() => void removeFolder()} disabled={busy}>Eliminar carpeta</button>
          <button type="button" onClick={() => setManaged(null)} disabled={busy}>Cancelar</button>
          <button type="button" className="is-primary" onClick={() => void saveName()} disabled={busy}>{busy ? 'Guardando…' : 'Guardar nombre'}</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
