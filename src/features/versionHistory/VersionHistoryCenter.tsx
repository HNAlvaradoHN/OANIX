import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes, restoreNoteVersion } from '../notes/noteService'
import { noteBlocksToPlainText, type NoteRecord } from '../notes/noteTypes'
import {
  listNoteVersionHistory,
  NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE,
} from './versionHistoryService'
import type { NoteHistorySnapshot } from './versionHistoryTypes'
import './versionHistory.css'

interface VersionHistoryCenterProps {
  onRestored: () => void
}

const VERSION_HISTORY_HOST_SELECTOR = '.notes-header__actions'

function mutationTouchesVersionHistoryHost(record: MutationRecord): boolean {
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
  return nodes.some((node) => {
    if (!(node instanceof Element)) return false
    return node.matches(VERSION_HISTORY_HOST_SELECTOR)
      || node.querySelector(VERSION_HISTORY_HOST_SELECTOR) !== null
  })
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

async function prepareWorkspaceForHistory(): Promise<boolean> {
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.blur()

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const saveStatus = document.querySelector<HTMLElement>('.save-status')?.textContent?.trim() ?? ''
    if (!saveStatus) return true
    if (/no se pudo guardar/i.test(saveStatus)) return false
    if (!/cambios pendientes|guardando/i.test(saveStatus)) return true
    await wait(100)
  }

  return false
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function snapshotPreview(snapshot: NoteHistorySnapshot): string {
  const text = noteBlocksToPlainText(snapshot.note.content.blocks).replace(/\s+/g, ' ').trim()
  if (!text) return 'Nota vacía'
  return text.length > 180 ? `${text.slice(0, 180)}…` : text
}

function snapshotDetail(snapshot: NoteHistorySnapshot): string {
  const text = noteBlocksToPlainText(snapshot.note.content.blocks).trim()
  if (!text) return 'Esta versión no contiene texto visible.'
  return text.length > 6000 ? `${text.slice(0, 6000)}\n\n…Vista previa recortada.` : text
}

export function VersionHistoryCenter({ onRestored }: VersionHistoryCenterProps) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [snapshots, setSnapshots] = useState<NoteHistorySnapshot[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    function refreshHost() {
      setHost(document.querySelector<HTMLElement>(VERSION_HISTORY_HOST_SELECTOR))
    }

    const appRoot = document.getElementById('root')
    if (!appRoot) return

    refreshHost()
    const observer = new MutationObserver((records) => {
      if (records.some(mutationTouchesVersionHistoryHost)) refreshHost()
    })
    observer.observe(appRoot, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    let active = true
    setLoadingNotes(true)
    setError('')
    setMessage('')

    void loadNotes()
      .then((loaded) => {
        if (!active) return
        setNotes(loaded)
        setSelectedNoteId((current) => {
          if (current && loaded.some((note) => note.id === current)) return current
          return loaded[0]?.id ?? ''
        })
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las notas.')
      })
      .finally(() => {
        if (active) setLoadingNotes(false)
      })

    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    if (!open || !selectedNoteId) {
      setSnapshots([])
      setSelectedSnapshotId('')
      return
    }

    let active = true
    setLoadingHistory(true)
    setError('')
    setMessage('')

    void listNoteVersionHistory(selectedNoteId)
      .then((loaded) => {
        if (!active) return
        setSnapshots(loaded)
        setSelectedSnapshotId((current) => {
          if (current && loaded.some((snapshot) => snapshot.id === current)) return current
          return loaded[0]?.id ?? ''
        })
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el historial cifrado.')
      })
      .finally(() => {
        if (active) setLoadingHistory(false)
      })

    return () => {
      active = false
    }
  }, [open, selectedNoteId])

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )
  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null,
    [snapshots, selectedSnapshotId],
  )

  async function handleOpen() {
    const safeToOpen = await prepareWorkspaceForHistory()
    if (!safeToOpen) {
      window.alert('OANIX no pudo confirmar el guardado de la nota abierta. Revisa el estado de guardado antes de abrir el historial.')
      return
    }
    setOpen(true)
  }

  async function handleRestore() {
    if (!selectedSnapshot || restoring) return

    const confirmed = window.confirm(
      `¿Restaurar esta versión de “${selectedSnapshot.note.title}”?\n\nOANIX guardará primero el estado actual en el historial para que esta restauración también pueda revertirse.`,
    )
    if (!confirmed) return

    setRestoring(true)
    setError('')
    setMessage('')

    try {
      const restored = await restoreNoteVersion(selectedSnapshot)
      const refreshedHistory = await listNoteVersionHistory(restored.id)
      const refreshedNotes = await loadNotes()
      setNotes(refreshedNotes)
      setSnapshots(refreshedHistory)
      setSelectedNoteId(restored.id)
      setSelectedSnapshotId(refreshedHistory[0]?.id ?? '')
      setMessage('Versión restaurada. El estado que tenías antes de restaurar también quedó guardado.')
      onRestored()
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'No se pudo restaurar esta versión.')
    } finally {
      setRestoring(false)
    }
  }

  const launcher = host && createPortal(
    <button
      className="icon-button version-history-launcher"
      type="button"
      onClick={() => void handleOpen()}
      aria-label="Historial de versiones"
      title="Historial de versiones"
    >
      🕘
    </button>,
    host,
  )

  return (
    <>
      {launcher}
      {open && (
        <div className="version-history-backdrop" role="presentation" onClick={() => !restoring && setOpen(false)}>
          <section
            className="version-history-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Historial de versiones"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="version-history-header">
              <div>
                <strong>Historial de versiones</strong>
                <span>Estados anteriores cifrados de tus notas</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={restoring} aria-label="Cerrar">×</button>
            </header>

            <label className="version-history-note-picker">
              <span>Nota</span>
              <select
                value={selectedNoteId}
                onChange={(event) => setSelectedNoteId(event.target.value)}
                disabled={loadingNotes || restoring || notes.length === 0}
              >
                {notes.map((note) => (
                  <option value={note.id} key={note.id}>{note.title}</option>
                ))}
              </select>
            </label>

            {error && <p className="version-history-status version-history-status--error" role="alert">{error}</p>}
            {message && <p className="version-history-status" role="status">{message}</p>}

            {loadingNotes ? (
              <div className="version-history-empty">Cargando notas…</div>
            ) : notes.length === 0 ? (
              <div className="version-history-empty">Todavía no hay notas.</div>
            ) : loadingHistory ? (
              <div className="version-history-empty">Descifrando historial…</div>
            ) : snapshots.length === 0 ? (
              <div className="version-history-empty">
                <strong>Aún no hay versiones anteriores de “{selectedNote?.title ?? 'esta nota'}”.</strong>
                <span>OANIX empezará a conservar puntos del historial cuando hagas cambios después de esta actualización.</span>
              </div>
            ) : (
              <div className="version-history-layout">
                <div className="version-history-list" role="list" aria-label="Versiones disponibles">
                  {snapshots.map((snapshot) => (
                    <button
                      type="button"
                      role="listitem"
                      className={`version-history-item${snapshot.id === selectedSnapshotId ? ' version-history-item--selected' : ''}`}
                      key={snapshot.id}
                      onClick={() => setSelectedSnapshotId(snapshot.id)}
                      disabled={restoring}
                    >
                      <span className="version-history-item__time">{formatDateTime(snapshot.capturedAt)}</span>
                      <span className="version-history-item__reason">
                        {snapshot.reason === 'pre-restore' ? 'Antes de una restauración' : 'Guardado automático'}
                      </span>
                      <span className="version-history-item__preview">{snapshotPreview(snapshot)}</span>
                    </button>
                  ))}
                </div>

                {selectedSnapshot && (
                  <article className="version-history-preview">
                    <div className="version-history-preview__meta">
                      <strong>{selectedSnapshot.note.title}</strong>
                      <span>{formatDateTime(selectedSnapshot.capturedAt)}</span>
                    </div>
                    <pre>{snapshotDetail(selectedSnapshot)}</pre>
                    <button
                      className="version-history-restore"
                      type="button"
                      onClick={() => void handleRestore()}
                      disabled={restoring}
                    >
                      {restoring ? 'Restaurando…' : 'Restaurar esta versión'}
                    </button>
                  </article>
                )}
              </div>
            )}

            <footer className="version-history-footer">
              Hasta {NOTE_HISTORY_MAX_SNAPSHOTS_PER_NOTE} puntos por nota · los guardados automáticos se agrupan en ventanas de 5 minutos.
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
