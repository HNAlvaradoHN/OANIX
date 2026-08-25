import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteEncryptedImage } from '../images/imageService'
import { deleteNote } from '../notes/noteService'
import {
  createNotePrivacyLock,
  listNotePrivacy,
  setNotePrivacyLock,
  validateNotePrivacyCode,
} from './notePrivacyService'
import './noteBulkPrivacy.css'

export const NOTE_PRIVACY_REFRESH_EVENT = 'oanix:note-privacy-refresh'

function noteRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]'))
}

function noteIdFromElement(target: Element): string | null {
  return target.closest<HTMLElement>('.note-row[data-reorder-note-id]')?.dataset.reorderNoteId?.trim() || null
}

function dispatchPrivacyRefresh() {
  window.dispatchEvent(new Event(NOTE_PRIVACY_REFRESH_EVENT))
}

function dispatchLocalNoteChange() {
  window.dispatchEvent(new CustomEvent('oanix:local-data-changed', { detail: { recordType: 'note' } }))
}

export function NoteBulkPrivacyRuntime() {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [finishMenuOpen, setFinishMenuOpen] = useState(false)
  const [protectedIds, setProtectedIds] = useState<Set<string>>(() => new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [code, setCode] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const selectedIdsRef = useRef(selectedIds)
  const selectionModeRef = useRef(selectionMode)
  const bypassCreateClickRef = useRef(false)
  const knownRowIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    selectionModeRef.current = selectionMode
  }, [selectionMode])

  useEffect(() => {
    knownRowIdsRef.current = new Set(
      noteRows().flatMap((row) => row.dataset.reorderNoteId ? [row.dataset.reorderNoteId] : []),
    )
    let frame = 0
    const scanRows = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        let foundNewNote = false
        for (const row of noteRows()) {
          const noteId = row.dataset.reorderNoteId
          if (!noteId || knownRowIdsRef.current.has(noteId)) continue
          knownRowIdsRef.current.add(noteId)
          foundNewNote = true
        }
        if (foundNewNote) dispatchPrivacyRefresh()
      })
    }

    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    if (!workspace) return
    const observer = new MutationObserver(scanRows)
    observer.observe(workspace, { childList: true, subtree: true })
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  async function refreshProtectedIds() {
    try {
      const records = await listNotePrivacy()
      setProtectedIds(new Set(records.filter((record) => !!record.lock).map((record) => record.noteId)))
    } catch {
      setProtectedIds(new Set())
    }
  }

  function clearSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setLauncherOpen(false)
    setFinishMenuOpen(false)
    setDialogOpen(false)
    setCode('')
    setConfirmCode('')
    setError('')
    setStatus('')
  }

  function beginSelection() {
    setLauncherOpen(false)
    setFinishMenuOpen(false)
    setSelectedIds(new Set())
    setError('')
    setStatus('')
    setSelectionMode(true)
    navigator.vibrate?.(12)
  }

  function toggleSelection(noteId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
    navigator.vibrate?.(8)
  }

  useEffect(() => {
    for (const row of noteRows()) {
      const noteId = row.dataset.reorderNoteId
      row.dataset.oanixBulkSelected = noteId && selectedIds.has(noteId) ? 'true' : 'false'
    }

    document.documentElement.classList.toggle('oanix-note-bulk-selecting', selectionMode)
    const fab = document.querySelector<HTMLButtonElement>('.notes-create-fab')
    if (fab) {
      fab.toggleAttribute('data-oanix-bulk-mode', selectionMode)
      if (selectionMode) {
        fab.setAttribute('aria-label', selectedIds.size > 0 ? `Terminar de marcar ${selectedIds.size} notas` : 'Terminar de marcar notas')
        fab.setAttribute('title', selectedIds.size > 0 ? `${selectedIds.size} seleccionada${selectedIds.size === 1 ? '' : 's'} · terminar` : 'Terminar de marcar')
      } else {
        fab.setAttribute('aria-label', 'Crear nueva nota')
        fab.setAttribute('title', 'Nueva nota')
      }
    }

    return () => {
      if (!selectionMode) return
      document.documentElement.classList.remove('oanix-note-bulk-selecting')
      for (const row of noteRows()) row.removeAttribute('data-oanix-bulk-selected')
      const activeFab = document.querySelector<HTMLButtonElement>('.notes-create-fab')
      activeFab?.removeAttribute('data-oanix-bulk-mode')
    }
  }, [selectedIds, selectionMode])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const fab = target.closest<HTMLButtonElement>('.notes-create-fab')
      if (fab) {
        if (bypassCreateClickRef.current) {
          bypassCreateClickRef.current = false
          return
        }

        event.preventDefault()
        event.stopImmediatePropagation()
        if (selectionModeRef.current) {
          if (selectedIdsRef.current.size === 0) clearSelection()
          else {
            setError('')
            setStatus('')
            setFinishMenuOpen(true)
          }
        } else {
          setLauncherOpen(true)
        }
        return
      }

      if (!selectionModeRef.current) return
      const noteId = noteIdFromElement(target)
      if (!noteId) return
      event.preventDefault()
      event.stopImmediatePropagation()
      toggleSelection(noteId)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (dialogOpen) return
      if (launcherOpen) {
        setLauncherOpen(false)
        return
      }
      if (finishMenuOpen) {
        setFinishMenuOpen(false)
        setError('')
        return
      }
      if (selectionModeRef.current) clearSelection()
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dialogOpen, finishMenuOpen, launcherOpen])

  const protectableIds = useMemo(
    () => [...selectedIds].filter((noteId) => !protectedIds.has(noteId)),
    [protectedIds, selectedIds],
  )

  function createNoteFromLauncher() {
    setLauncherOpen(false)
    const fab = document.querySelector<HTMLButtonElement>('.notes-create-fab')
    if (!fab || fab.disabled) return
    bypassCreateClickRef.current = true
    fab.click()
  }

  async function openBulkDialog() {
    setFinishMenuOpen(false)
    setError('')
    setStatus('')
    setCode('')
    setConfirmCode('')
    await refreshProtectedIds()
    setDialogOpen(true)
  }

  async function handleProtectSelected() {
    if (busy) return
    const validation = validateNotePrivacyCode(code)
    if (validation) {
      setError(validation)
      return
    }
    if (code !== confirmCode) {
      setError('Los códigos no coinciden.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const records = await listNotePrivacy()
      const alreadyProtected = new Set(records.filter((record) => !!record.lock).map((record) => record.noteId))
      const targets = [...selectedIdsRef.current].filter((noteId) => !alreadyProtected.has(noteId))
      if (targets.length === 0) {
        setError('Las notas seleccionadas ya tienen protección individual.')
        return
      }

      for (let index = 0; index < targets.length; index += 1) {
        setStatus(`Protegiendo ${index + 1} de ${targets.length}…`)
        const lock = await createNotePrivacyLock(code)
        await setNotePrivacyLock(targets[index], lock)
      }

      dispatchPrivacyRefresh()
      clearSelection()
    } catch (protectError) {
      setError(protectError instanceof Error ? protectError.message : 'No se pudieron proteger las notas seleccionadas.')
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIdsRef.current]
    if (ids.length === 0 || busy) return

    const lockedIds = ids.filter((noteId) => {
      const row = noteRows().find((candidate) => candidate.dataset.reorderNoteId === noteId)
      return row?.dataset.oanixNoteLocked === 'true'
    })
    if (lockedIds.length > 0) {
      setError(
        lockedIds.length === 1
          ? 'Hay una nota todavía bloqueada. Desbloquéala con su código antes de borrarla.'
          : `Hay ${lockedIds.length} notas todavía bloqueadas. Desbloquéalas con sus códigos antes de borrarlas.`,
      )
      setStatus('')
      return
    }

    const confirmed = window.confirm(
      `¿Eliminar ${ids.length} nota${ids.length === 1 ? '' : 's'} de forma permanente?\n\nSe eliminarán de este dispositivo junto con sus imágenes asociadas. Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    setBusy(true)
    setFinishMenuOpen(false)
    setError('')
    try {
      const imageIds: string[] = []
      for (let index = 0; index < ids.length; index += 1) {
        setStatus(`Eliminando ${index + 1} de ${ids.length}…`)
        const deleted = await deleteNote(ids[index])
        for (const block of deleted.content.blocks) {
          if (block.type === 'image') imageIds.push(block.imageId)
        }
      }
      await Promise.allSettled(imageIds.map((imageId) => deleteEncryptedImage(imageId)))
      dispatchLocalNoteChange()
      dispatchPrivacyRefresh()
      clearSelection()
      window.dispatchEvent(new Event('oanix:workspace-refresh'))
      navigator.vibrate?.(14)
    } catch {
      setError('No se pudieron eliminar todas las notas seleccionadas. OANIX refrescará la lista para mostrar el estado real.')
      window.dispatchEvent(new Event('oanix:workspace-refresh'))
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  return (
    <>
      {launcherOpen && createPortal(
        <div className="oanix-note-action-backdrop" role="presentation" onClick={() => setLauncherOpen(false)}>
          <div className="oanix-note-action-sheet" role="menu" aria-label="Crear o marcar notas" onClick={(event) => event.stopPropagation()}>
            <span className="oanix-note-action-sheet__eyebrow">NOTAS</span>
            <strong>¿Qué quieres hacer?</strong>
            <button type="button" role="menuitem" onClick={createNoteFromLauncher}>
              <span className="oanix-note-action-sheet__icon" aria-hidden="true">＋</span>
              <span><b>Agregar nota</b><small>Crear una nota nueva y abrirla</small></span>
            </button>
            <button type="button" role="menuitem" onClick={beginSelection}>
              <span className="oanix-note-action-sheet__icon" aria-hidden="true">✓</span>
              <span><b>Marcar notas</b><small>Seleccionar varias para aplicar acciones</small></span>
            </button>
          </div>
        </div>,
        document.body,
      )}

      {finishMenuOpen && createPortal(
        <div className="oanix-note-action-backdrop" role="presentation" onClick={() => {
          setFinishMenuOpen(false)
          setError('')
        }}>
          <div className="oanix-note-action-sheet oanix-note-action-sheet--finish" role="menu" aria-label="Acciones para notas seleccionadas" onClick={(event) => event.stopPropagation()}>
            <span className="oanix-note-action-sheet__eyebrow">{selectedIds.size} SELECCIONADA{selectedIds.size === 1 ? '' : 'S'}</span>
            <strong>Terminar selección</strong>
            {error && <p className="oanix-note-action-sheet__notice" role="alert">{error}</p>}
            <button type="button" role="menuitem" onClick={() => void openBulkDialog()}>
              <span className="oanix-note-action-sheet__icon" aria-hidden="true">🔒</span>
              <span><b>Aplicar código</b><small>Proteger las que todavía no tengan código</small></span>
            </button>
            <button className="oanix-note-action-sheet__danger" type="button" role="menuitem" onClick={() => void handleDeleteSelected()}>
              <span className="oanix-note-action-sheet__icon" aria-hidden="true">🗑</span>
              <span><b>Borrar</b><small>Eliminar permanentemente las seleccionadas</small></span>
            </button>
            <button className="oanix-note-action-sheet__cancel" type="button" role="menuitem" onClick={clearSelection}>
              Cancelar selección
            </button>
          </div>
        </div>,
        document.body,
      )}

      {dialogOpen && createPortal(
        <div className="oanix-bulk-lock-overlay" role="presentation" onClick={() => !busy && setDialogOpen(false)}>
          <form
            className="oanix-bulk-lock-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Proteger notas seleccionadas"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void handleProtectSelected()
            }}
          >
            <header>
              <div><span>PROTECCIÓN MÚLTIPLE</span><strong>Un código para varias notas</strong></div>
              <button type="button" onClick={() => setDialogOpen(false)} disabled={busy} aria-label="Cerrar">×</button>
            </header>
            <p>
              Se aplicará el mismo código a {protectableIds.length} nota{protectableIds.length === 1 ? '' : 's'} sin protección. Las que ya tengan código conservarán el suyo.
            </p>
            <label>
              <span>Código</span>
              <input type="password" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" maxLength={40} autoFocus />
            </label>
            <label>
              <span>Repetir código</span>
              <input type="password" value={confirmCode} onChange={(event) => setConfirmCode(event.target.value)} autoComplete="off" maxLength={40} />
            </label>
            <small>1–20 caracteres · cada nota guarda un verificador independiente y cifrado.</small>
            {status && <p className="oanix-bulk-lock-status" role="status">{status}</p>}
            {error && <p className="oanix-bulk-lock-error" role="alert">{error}</p>}
            <div className="oanix-bulk-lock-actions">
              <button type="button" onClick={() => setDialogOpen(false)} disabled={busy}>Cancelar</button>
              <button type="submit" disabled={busy || !code || !confirmCode}>{busy ? 'Protegiendo…' : 'Proteger notas'}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  )
}
