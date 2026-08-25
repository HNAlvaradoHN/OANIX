import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createNotePrivacyLock,
  listNotePrivacy,
  setNotePrivacyLock,
  validateNotePrivacyCode,
} from './notePrivacyService'
import './noteBulkPrivacy.css'

export const NOTE_PRIVACY_REFRESH_EVENT = 'oanix:note-privacy-refresh'

const LONG_PRESS_MS = 760
const LONG_PRESS_MOVE_TOLERANCE = 12
const NOTE_BULK_SELECTION_START_EVENT = 'oanix:note-bulk-selection-start'

interface ActivePress {
  pointerId: number
  noteId: string
  startX: number
  startY: number
  timer: number
  triggered: boolean
}

function noteRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.note-row[data-reorder-note-id]'))
}

function noteIdFromElement(target: Element): string | null {
  return target.closest<HTMLElement>('.note-row[data-reorder-note-id]')?.dataset.reorderNoteId?.trim() || null
}

function dispatchPrivacyRefresh() {
  window.dispatchEvent(new Event(NOTE_PRIVACY_REFRESH_EVENT))
}

export function NoteBulkPrivacyRuntime() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [protectedIds, setProtectedIds] = useState<Set<string>>(() => new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [code, setCode] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const selectedIdsRef = useRef(selectedIds)
  const activePressRef = useRef<ActivePress | null>(null)
  const suppressNextClickRef = useRef<string | null>(null)
  const knownRowIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  async function refreshProtectedIds() {
    try {
      const records = await listNotePrivacy()
      setProtectedIds(new Set(records.filter((record) => !!record.lock).map((record) => record.noteId)))
    } catch {
      // The normal privacy runtime remains authoritative if this optional helper cannot refresh.
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setDialogOpen(false)
    setCode('')
    setConfirmCode('')
    setError('')
    setStatus('')
  }

  function toggleSelection(noteId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  useEffect(() => {
    const initialIds = noteRows().flatMap((row) => row.dataset.reorderNoteId ? [row.dataset.reorderNoteId] : [])
    knownRowIdsRef.current = new Set(initialIds)

    let frame = 0
    const scanRows = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const rows = noteRows()
        const visibleIds = new Set<string>()
        let foundNewNote = false

        for (const row of rows) {
          const noteId = row.dataset.reorderNoteId
          if (!noteId) continue
          visibleIds.add(noteId)
          if (!knownRowIdsRef.current.has(noteId)) {
            knownRowIdsRef.current.add(noteId)
            foundNewNote = true
          }
        }

        setSelectedIds((current) => {
          if (current.size === 0) return current
          const next = new Set([...current].filter((noteId) => visibleIds.has(noteId)))
          return next.size === current.size ? current : next
        })

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

  useEffect(() => {
    for (const row of noteRows()) {
      const noteId = row.dataset.reorderNoteId
      row.dataset.oanixBulkSelected = noteId && selectedIds.has(noteId) ? 'true' : 'false'
    }

    document.documentElement.classList.toggle('oanix-note-bulk-selecting', selectedIds.size > 0)
    return () => {
      document.documentElement.classList.remove('oanix-note-bulk-selecting')
    }
  }, [selectedIds])

  useEffect(() => {
    function clearActivePress() {
      const active = activePressRef.current
      if (!active) return
      window.clearTimeout(active.timer)
      activePressRef.current = null
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const openButton = target.closest<HTMLButtonElement>('.note-row__open')
      if (!openButton || openButton.getAttribute('aria-disabled') === 'true') return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const noteId = noteIdFromElement(openButton)
      if (!noteId) return

      clearActivePress()
      const active: ActivePress = {
        pointerId: event.pointerId,
        noteId,
        startX: event.clientX,
        startY: event.clientY,
        timer: 0,
        triggered: false,
      }
      active.timer = window.setTimeout(() => {
        if (document.body.hasAttribute('data-oanix-note-drag-active')) {
          activePressRef.current = null
          return
        }
        active.triggered = true
        suppressNextClickRef.current = noteId
        window.dispatchEvent(new CustomEvent(NOTE_BULK_SELECTION_START_EVENT, { detail: { noteId } }))
        setSelectedIds((current) => new Set(current).add(noteId))
        void refreshProtectedIds()
      }, LONG_PRESS_MS)
      activePressRef.current = active
    }

    function handlePointerMove(event: PointerEvent) {
      const active = activePressRef.current
      if (!active || active.pointerId !== event.pointerId || active.triggered) return
      const moved = Math.hypot(event.clientX - active.startX, event.clientY - active.startY)
      if (moved > LONG_PRESS_MOVE_TOLERANCE) clearActivePress()
    }

    function handlePointerEnd(event: PointerEvent) {
      const active = activePressRef.current
      if (!active || active.pointerId !== event.pointerId) return
      window.clearTimeout(active.timer)
      activePressRef.current = null
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const row = target.closest<HTMLElement>('.note-row[data-reorder-note-id]')
      const noteId = row?.dataset.reorderNoteId
      if (!row || !noteId) return

      if (suppressNextClickRef.current === noteId) {
        suppressNextClickRef.current = null
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }

      if (selectedIdsRef.current.size > 0) {
        event.preventDefault()
        event.stopImmediatePropagation()
        toggleSelection(noteId)
      }
    }

    function handleContextMenu(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.note-row[data-reorder-note-id]')) return
      if (selectedIdsRef.current.size > 0 || suppressNextClickRef.current) event.preventDefault()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && selectedIdsRef.current.size > 0 && !dialogOpen) clearSelection()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerEnd, true)
    document.addEventListener('pointercancel', handlePointerEnd, true)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('contextmenu', handleContextMenu, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearActivePress()
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerEnd, true)
      document.removeEventListener('pointercancel', handlePointerEnd, true)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dialogOpen])

  const protectableIds = useMemo(
    () => [...selectedIds].filter((noteId) => !protectedIds.has(noteId)),
    [protectedIds, selectedIds],
  )

  async function openBulkDialog() {
    await refreshProtectedIds()
    setError('')
    setStatus('')
    setCode('')
    setConfirmCode('')
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

  return (
    <>
      {selectedIds.size > 0 && createPortal(
        <aside className="oanix-note-bulk-bar" aria-label="Notas seleccionadas">
          <button className="oanix-note-bulk-bar__close" type="button" onClick={clearSelection} aria-label="Cancelar selección">×</button>
          <div>
            <strong>{selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}</strong>
            <small>Toca otras notas para marcarlas o desmarcarlas.</small>
          </div>
          <button
            className="oanix-note-bulk-bar__protect"
            type="button"
            onClick={() => void openBulkDialog()}
            disabled={protectableIds.length === 0}
          >
            🔒 {protectableIds.length > 0 ? `Proteger ${protectableIds.length}` : 'Ya protegidas'}
          </button>
        </aside>,
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
