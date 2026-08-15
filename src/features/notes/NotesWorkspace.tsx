import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { deleteEncryptedImage } from '../images/imageService'
import { ImageNoteEditor } from '../images/ImageNoteEditor'
import { createEmptyNote, loadNotes, renameNote, replaceNoteContent } from './noteService'
import { noteBlocksToPlainText, type NoteRecord, type StoredNoteBlock } from './noteTypes'
import './notes.css'

interface NotesWorkspaceProps {
  onLock: () => void
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface PendingContent {
  noteId: string
  blocks: StoredNoteBlock[]
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

function notePreview(note: NoteRecord): string {
  return noteBlocksToPlainText(note.content.blocks) || 'Nota vacía · empieza a escribir'
}

function saveStateLabel(saveState: SaveState, savingTitle: boolean): string {
  if (savingTitle) return 'Guardando título…'
  if (saveState === 'dirty') return 'Cambios pendientes…'
  if (saveState === 'saving') return 'Guardando cifrado…'
  if (saveState === 'saved') return 'Guardado · cifrado local'
  if (saveState === 'error') return 'No se pudo guardar'
  return 'Cifrada en este dispositivo'
}

export function NotesWorkspace({ onLock }: NotesWorkspaceProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  const pendingContentRef = useRef<PendingContent | null>(null)
  const activeSaveRef = useRef<Promise<boolean> | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const pendingImageDeletesRef = useRef(new Set<string>())

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  )

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

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

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  function replaceNoteInState(updated: NoteRecord) {
    setNotes((current) =>
      current
        .map((note) => (note.id === updated.id ? updated : note))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    )
  }

  function clearSaveTimer() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }

  async function flushPendingContent(): Promise<boolean> {
    clearSaveTimer()
    const pending = pendingContentRef.current

    if (!pending) {
      return activeSaveRef.current ? await activeSaveRef.current : true
    }

    pendingContentRef.current = null
    if (selectedIdRef.current === pending.noteId) setSaveState('saving')
    setError('')

    const savePromise = (async () => {
      try {
        const updated = await replaceNoteContent(pending.noteId, pending.blocks)
        replaceNoteInState(updated)
        setError('')

        if (selectedIdRef.current === pending.noteId) {
          setSaveState(pendingContentRef.current ? 'dirty' : 'saved')
        }
        return true
      } catch {
        if (!pendingContentRef.current) pendingContentRef.current = pending
        if (selectedIdRef.current === pending.noteId) setSaveState('error')
        setError('No se pudieron guardar los cambios cifrados de la nota.')
        return false
      }
    })()

    activeSaveRef.current = savePromise
    const result = await savePromise
    if (activeSaveRef.current === savePromise) activeSaveRef.current = null
    return result
  }

  function handleContentChange(blocks: StoredNoteBlock[]) {
    if (!selectedNote) return

    pendingContentRef.current = { noteId: selectedNote.id, blocks }
    setSaveState('dirty')
    setError('')
    clearSaveTimer()
    saveTimerRef.current = window.setTimeout(() => {
      void flushPendingContent()
    }, 550)
  }

  async function handleRemovedImage(imageId: string): Promise<void> {
    pendingImageDeletesRef.current.add(imageId)
  }

  function handleRestoredImage(imageId: string) {
    pendingImageDeletesRef.current.delete(imageId)
  }

  async function finalizeRemovedImages(): Promise<void> {
    const imageIds = [...pendingImageDeletesRef.current]
    pendingImageDeletesRef.current.clear()

    await Promise.allSettled(imageIds.map((imageId) => deleteEncryptedImage(imageId)))
  }

  async function handleCreateNote() {
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    setCreating(true)
    setError('')

    try {
      const note = await createEmptyNote()
      setNotes((current) => [note, ...current])
      setSelectedId(note.id)
      setSaveState('idle')
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

    if (!(await flushPendingContent())) return

    setSavingTitle(true)
    setError('')

    try {
      const updated = await renameNote(selectedNote.id, draftTitle)
      replaceNoteInState(updated)
      setDraftTitle(updated.title)
      setSaveState('saved')
    } catch {
      setDraftTitle(selectedNote.title)
      setSaveState('error')
      setError('No se pudo guardar el nuevo título de la nota.')
    } finally {
      setSavingTitle(false)
    }
  }

  async function handleSelectNote(noteId: string) {
    if (noteId === selectedId) return
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()

    setSelectedId(noteId)
    setSaveState('idle')
  }

  async function handleBack() {
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()
    setSelectedId(null)
    setSaveState('idle')
  }

  async function handleLockWorkspace() {
    if (!(await flushPendingContent())) return
    await finalizeRemovedImages()
    onLock()
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
              onClick={() => void handleLockWorkspace()}
              aria-label="Bloquear OANIX"
              title="Bloquear OANIX"
            >
              ◼
            </button>
            <button
              className="new-note-button"
              type="button"
              onClick={() => void handleCreateNote()}
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
              <button className="empty-action" type="button" onClick={() => void handleCreateNote()} disabled={creating}>
                Crear primera nota
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <button
                className={`note-row${selectedId === note.id ? ' note-row--selected' : ''}`}
                type="button"
                key={note.id}
                onClick={() => void handleSelectNote(note.id)}
              >
                <span className="note-row__avatar" aria-hidden="true">{noteInitial(note.title)}</span>
                <span className="note-row__body">
                  <span className="note-row__topline">
                    <strong>{note.title}</strong>
                    <time dateTime={note.updatedAt}>{formatNoteTime(note.updatedAt)}</time>
                  </span>
                  <span className="note-row__preview">{notePreview(note)}</span>
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
                onClick={() => void handleBack()}
                aria-label="Volver a la lista de notas"
              >
                ←
              </button>
              <div className="note-view__identity">
                <span className="note-view__avatar" aria-hidden="true">{noteInitial(selectedNote.title)}</span>
                <div>
                  <strong>{selectedNote.title}</strong>
                  <span className={saveState === 'error' ? 'save-status save-status--error' : 'save-status'}>
                    {saveStateLabel(saveState, savingTitle)}
                  </span>
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

              <ImageNoteEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                initialBlocks={selectedNote.content.blocks}
                onChange={handleContentChange}
                onBlur={() => void flushPendingContent()}
                onRemoveImage={handleRemovedImage}
                onRestoreImage={handleRestoredImage}
              />
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
