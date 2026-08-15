import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { createEmptyNote, loadNotes, renameNote } from './noteService'
import type { NoteRecord } from './noteTypes'
import './notes.css'

interface NotesWorkspaceProps {
  onLock: () => void
}

function formatNoteTime(isoDate: string): string {
  const date = new Date(isoDate)
  const today = new Date()

  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('es-HN', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function noteInitial(title: string): string {
  const first = title.trim().charAt(0)
  return first ? first.toUpperCase() : 'N'
}

export function NotesWorkspace({ onLock }: NotesWorkspaceProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [error, setError] = useState('')

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  )

  useEffect(() => {
    let active = true

    void loadNotes()
      .then((storedNotes) => {
        if (!active) return
        setNotes(storedNotes)
      })
      .catch(() => {
        if (!active) return
        setError('No se pudieron cargar las notas cifradas de este dispositivo.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setDraftTitle(selectedNote?.title ?? '')
  }, [selectedNote?.id, selectedNote?.title])

  async function handleCreateNote() {
    setCreating(true)
    setError('')

    try {
      const note = await createEmptyNote()
      setNotes((current) => [note, ...current])
      setSelectedId(note.id)
    } catch {
      setError('No se pudo crear la nota cifrada.')
    } finally {
      setCreating(false)
    }
  }

  async function persistTitle() {
    if (!selectedNote || savingTitle) return

    if (draftTitle.trim() === selectedNote.title) {
      setDraftTitle(selectedNote.title)
      return
    }

    setSavingTitle(true)
    setError('')

    try {
      const updated = await renameNote(selectedNote.id, draftTitle)
      setNotes((current) =>
        current
          .map((note) => (note.id === updated.id ? updated : note))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      )
      setDraftTitle(updated.title)
    } catch {
      setDraftTitle(selectedNote.title)
      setError('No se pudo guardar el nuevo título de la nota.')
    } finally {
      setSavingTitle(false)
    }
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    }
  }

  return (
    <main className={`notes-shell${selectedNote ? ' notes-shell--open' : ''}`}>
      <aside className="notes-sidebar" aria-label="Lista de notas">
        <header className="notes-header">
          <div className="notes-brand">
            <div className="notes-brand__mark" aria-hidden="true">O</div>
            <div>
              <strong>OANIX</strong>
              <span>Notas privadas</span>
            </div>
          </div>
          <div className="notes-header__actions">
            <button
              className="icon-button"
              type="button"
              onClick={onLock}
              aria-label="Bloquear OANIX"
              title="Bloquear OANIX"
            >
              ◼
            </button>
            <button
              className="new-note-button"
              type="button"
              onClick={handleCreateNote}
              disabled={creating}
            >
              <span aria-hidden="true">＋</span>
              <span>{creating ? 'Creando…' : 'Nueva'}</span>
            </button>
          </div>
        </header>

        <nav className="notes-tabs" aria-label="Carpetas de notas">
          <button className="notes-tab notes-tab--active" type="button" aria-current="page">
            Todas
          </button>
        </nav>

        {error && <p className="notes-error" role="alert">{error}</p>}

        <div className="notes-list">
          {loading ? (
            <div className="notes-empty">
              <strong>Cargando notas…</strong>
              <p>Descifrando la lista local.</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty__icon" aria-hidden="true">✎</div>
              <strong>Aún no hay notas</strong>
              <p>Crea la primera. Se guardará cifrada en este dispositivo.</p>
              <button className="empty-action" type="button" onClick={handleCreateNote} disabled={creating}>
                Crear primera nota
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <button
                className={`note-row${selectedId === note.id ? ' note-row--selected' : ''}`}
                type="button"
                key={note.id}
                onClick={() => setSelectedId(note.id)}
              >
                <span className="note-row__avatar" aria-hidden="true">{noteInitial(note.title)}</span>
                <span className="note-row__body">
                  <span className="note-row__topline">
                    <strong>{note.title}</strong>
                    <time dateTime={note.updatedAt}>{formatNoteTime(note.updatedAt)}</time>
                  </span>
                  <span className="note-row__preview">Nota vacía · lista para el editor</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="note-view" aria-label="Nota abierta">
        {selectedNote ? (
          <>
            <header className="note-view__header">
              <button
                className="back-button"
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Volver a la lista de notas"
              >
                ←
              </button>
              <div className="note-view__identity">
                <span className="note-view__avatar" aria-hidden="true">{noteInitial(selectedNote.title)}</span>
                <div>
                  <strong>{selectedNote.title}</strong>
                  <span>Cifrada en este dispositivo</span>
                </div>
              </div>
            </header>

            <div className="note-canvas">
              <label className="note-title-field" htmlFor="note-title">
                <span>Título</span>
                <input
                  id="note-title"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => void persistTitle()}
                  onKeyDown={handleTitleKeyDown}
                  maxLength={160}
                  disabled={savingTitle}
                  aria-busy={savingTitle}
                />
              </label>

              <div className="note-editor-placeholder">
                <div className="note-editor-placeholder__icon" aria-hidden="true">✦</div>
                <strong>La nota ya existe y está cifrada</strong>
                <p>
                  El editor de contenido será el siguiente bloque de V1. Aquí aparecerán texto,
                  listas, código, imágenes y otros bloques sin convertir la nota en un chat real.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="note-view__empty">
            <div className="note-view__empty-mark" aria-hidden="true">O</div>
            <strong>Selecciona una nota</strong>
            <p>La experiencia se organiza como una lista de conversaciones, pero cada elemento es una nota privada.</p>
          </div>
        )}
      </section>
    </main>
  )
}
