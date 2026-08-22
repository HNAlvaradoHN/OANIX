import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { loadNotes } from '../notes/noteService'
import {
  deleteAllEncryptedAttachmentsForNote,
  loadEncryptedAttachmentFile,
  loadEncryptedAttachments,
  removeEncryptedAttachment,
  storeEncryptedAttachment,
} from './attachmentService'
import {
  MAX_LOCAL_ATTACHMENT_BYTES,
  attachmentIcon,
  attachmentKind,
  attachmentTypeLabel,
  formatAttachmentSize,
  isRemoteLargeAttachment,
  type AttachmentMetadata,
} from './attachmentTypes'
import './attachments.css'

interface AttachmentTargets {
  noteId: string | null
  editorRoot: HTMLElement | null
  toolbar: HTMLElement | null
  insertGrid: HTMLElement | null
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function currentNoteId(): string | null {
  const selected = document.querySelector<HTMLElement>('.note-row--selected[data-reorder-note-id]')
  const selectedId = selected?.dataset.reorderNoteId?.trim()
  if (selectedId) return selectedId

  const historyState = window.history.state
  if (historyState && typeof historyState === 'object' && typeof historyState.noteId === 'string') {
    const historyId = historyState.noteId.trim()
    if (historyId) return historyId
  }

  return null
}

function currentTargets(): AttachmentTargets {
  const editorRoot = document.querySelector<HTMLElement>('.image-note-editor-root')
  if (!editorRoot) {
    return { noteId: null, editorRoot: null, toolbar: null, insertGrid: null }
  }

  return {
    noteId: currentNoteId(),
    editorRoot,
    toolbar: editorRoot.querySelector<HTMLElement>('.editor-toolbar'),
    insertGrid: editorRoot.querySelector<HTMLElement>('.editor-command-grid--insert'),
  }
}

function sameTargets(left: AttachmentTargets, right: AttachmentTargets): boolean {
  return (
    left.noteId === right.noteId &&
    left.editorRoot === right.editorRoot &&
    left.toolbar === right.toolbar &&
    left.insertGrid === right.insertGrid
  )
}

function closeEditorCommandPanel(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

function isPreviewable(item: AttachmentMetadata): boolean {
  const kind = attachmentKind(item)
  return ['pdf', 'image', 'video', 'audio', 'text'].includes(kind)
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function shareOrDownloadFile(file: File): Promise<void> {
  const shareData: ShareData = {
    files: [file],
    title: file.name,
  }

  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare(shareData)
  ) {
    try {
      await navigator.share(shareData)
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      // Some WebViews expose file sharing but reject it at runtime. Download remains the fallback.
    }
  }

  downloadFile(file)
}

async function cleanupAttachmentsAfterPossibleNoteDeletion(noteId: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await wait(attempt === 0 ? 300 : 250)
    try {
      const notes = await loadNotes()
      if (notes.some((note) => note.id === noteId)) continue
      await deleteAllEncryptedAttachmentsForNote(noteId)
      return
    } catch {
      return
    }
  }
}

function attachmentLocationLabel(item: AttachmentMetadata): string {
  return isRemoteLargeAttachment(item) ? 'Drive · cifrado por fragmentos' : 'Local · cifrado'
}

export function NoteAttachmentsRuntime() {
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerNoteIdRef = useRef<string | null>(null)
  const highlightTimerRef = useRef<number | null>(null)
  const [targets, setTargets] = useState<AttachmentTargets>(() => currentTargets())
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([])
  const [newAttachmentIds, setNewAttachmentIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const next = currentTargets()
        setTargets((current) => sameTargets(current, next) ? current : next)
      })
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
    window.addEventListener('popstate', refresh)

    function handlePossibleDelete(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLButtonElement>('.note-row__menu-danger, .note-view__menu-danger')
      if (!button) return

      const row = button.closest<HTMLElement>('[data-reorder-note-id]')
      const noteId = row?.dataset.reorderNoteId?.trim() || currentNoteId()
      if (noteId) void cleanupAttachmentsAfterPossibleNoteDeletion(noteId)
    }

    document.addEventListener('click', handlePossibleDelete, true)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('popstate', refresh)
      document.removeEventListener('click', handlePossibleDelete, true)
    }
  }, [])

  useEffect(() => {
    let active = true
    setAttachments([])
    setNewAttachmentIds(new Set())
    setError('')
    setStatus('')
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }

    if (!targets.noteId) {
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    void loadEncryptedAttachments(targets.noteId)
      .then((items) => {
        if (active) setAttachments(items)
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los adjuntos cifrados.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [targets.noteId])

  useEffect(() => {
    if (newAttachmentIds.size === 0 || !targets.editorRoot) return

    const frame = window.requestAnimationFrame(() => {
      const firstNewCard = targets.editorRoot?.querySelector<HTMLElement>('.note-attachment-card[data-oanix-new="true"]')
      firstNewCard?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [newAttachmentIds, targets.editorRoot])

  useEffect(() => () => {
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
  }, [])

  function beginAttachmentSelection() {
    const noteId = currentNoteId()
    if (!noteId) {
      setError('Abre una nota antes de adjuntar un archivo.')
      return
    }

    pickerNoteIdRef.current = noteId
    setError('')
    setStatus('')
    closeEditorCommandPanel()
    inputRef.current?.click()
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    const noteId = pickerNoteIdRef.current
    pickerNoteIdRef.current = null
    if (!noteId || files.length === 0 || busy) return

    setBusy(true)
    setError('')
    try {
      const storedItems: AttachmentMetadata[] = []
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setStatus(
          file.size > MAX_LOCAL_ATTACHMENT_BYTES
            ? `Cifrando y subiendo archivo ${index + 1} de ${files.length} a Drive…`
            : `Cifrando archivo ${index + 1} de ${files.length} localmente…`,
        )
        storedItems.push(await storeEncryptedAttachment(noteId, file))
      }
      const items = await loadEncryptedAttachments(noteId)
      if (currentNoteId() === noteId) {
        setAttachments(items)
        setNewAttachmentIds(new Set(storedItems.map((item) => item.attachmentId)))
        const remoteCount = storedItems.filter(isRemoteLargeAttachment).length
        setStatus(
          files.length === 1
            ? remoteCount === 1 ? 'Archivo grande cifrado y guardado en Drive ↓' : 'Archivo cifrado agregado ↓'
            : `${files.length} archivos agregados · ${remoteCount} en Drive ↓`,
        )

        if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = window.setTimeout(() => {
          setNewAttachmentIds(new Set())
          setStatus('')
          highlightTimerRef.current = null
        }, 3200)
      }
    } catch (storeError) {
      setError(storeError instanceof Error ? storeError.message : 'No se pudo guardar el archivo cifrado.')
    } finally {
      setBusy(false)
    }
  }

  async function requireAttachmentFile(item: AttachmentMetadata): Promise<File | null> {
    setError('')
    if (isRemoteLargeAttachment(item)) {
      setError('Abrir y exportar archivos grandes de Drive se habilitará cuando la recuperación por rangos esté conectada.')
      return null
    }

    try {
      const file = await loadEncryptedAttachmentFile(item)
      if (!file) {
        setError('El archivo cifrado no está disponible en este dispositivo.')
        return null
      }
      return file
    } catch {
      setError('No se pudo descifrar el archivo seleccionado.')
      return null
    }
  }

  async function handleOpen(item: AttachmentMetadata) {
    if (busy || isRemoteLargeAttachment(item)) return
    setBusy(true)
    try {
      const file = await requireAttachmentFile(item)
      if (!file) return

      if (!isPreviewable(item)) {
        await shareOrDownloadFile(file)
        return
      }

      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setBusy(false)
    }
  }

  async function handleExport(item: AttachmentMetadata) {
    if (busy || isRemoteLargeAttachment(item)) return
    setBusy(true)
    try {
      const file = await requireAttachmentFile(item)
      if (file) await shareOrDownloadFile(file)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(item: AttachmentMetadata) {
    const noteId = targets.noteId
    if (!noteId || busy) return
    const remote = isRemoteLargeAttachment(item)
    const confirmation = remote
      ? `¿Quitar “${item.name}” de esta nota?\n\nEl objeto cifrado también se eliminará de Google Drive.`
      : `¿Quitar “${item.name}” de esta nota?\n\nLa copia cifrada guardada por OANIX se eliminará.`
    if (!window.confirm(confirmation)) return

    setBusy(true)
    setError('')
    try {
      await removeEncryptedAttachment(noteId, item.attachmentId)
      setAttachments((current) => current.filter((attachment) => attachment.attachmentId !== item.attachmentId))
      setNewAttachmentIds((current) => {
        const next = new Set(current)
        next.delete(item.attachmentId)
        return next
      })
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo quitar el adjunto cifrado.')
    } finally {
      setBusy(false)
    }
  }

  const remoteCount = attachments.filter(isRemoteLargeAttachment).length
  const localCount = attachments.length - remoteCount
  const panelVisible = Boolean(targets.noteId && (loading || busy || error || status || attachments.length > 0))

  return (
    <>
      <input
        ref={inputRef}
        className="note-attachments__input"
        type="file"
        multiple
        onChange={(event) => void handleFileSelection(event)}
        tabIndex={-1}
        aria-hidden="true"
      />

      {targets.toolbar && createPortal(
        <button
          className="editor-tool note-attachments__tool"
          type="button"
          disabled={busy}
          onMouseDown={(event) => event.preventDefault()}
          onClick={beginAttachmentSelection}
          aria-label="Adjuntar archivo cifrado"
          title="Adjuntar archivo"
        >
          📎
        </button>,
        targets.toolbar,
      )}

      {targets.insertGrid && createPortal(
        <button
          type="button"
          disabled={busy}
          onPointerDown={(event) => event.preventDefault()}
          onClick={beginAttachmentSelection}
        >
          <strong>📎</strong><span>Archivo</span>
        </button>,
        targets.insertGrid,
      )}

      {targets.editorRoot && panelVisible && createPortal(
        <section className="note-attachments" aria-label="Archivos adjuntos de la nota">
          <div className="note-attachments__heading">
            <div>
              <strong>Adjuntos</strong>
              <span>
                {attachments.length} archivo{attachments.length === 1 ? '' : 's'}
                {attachments.length > 0 ? ` · ${localCount} local${localCount === 1 ? '' : 'es'} · ${remoteCount} Drive` : ''}
              </span>
            </div>
            <button type="button" onClick={beginAttachmentSelection} disabled={busy}>＋</button>
          </div>

          {attachments.length > 0 && (
            <div className="note-attachments__list">
              {attachments.map((item) => {
                const isNew = newAttachmentIds.has(item.attachmentId)
                const remote = isRemoteLargeAttachment(item)
                const unavailableTitle = remote
                  ? 'Pendiente: recuperación cifrada por rangos desde Drive'
                  : undefined
                return (
                  <article
                    className="note-attachment-card"
                    data-oanix-new={isNew ? 'true' : 'false'}
                    data-oanix-storage={remote ? 'remote' : 'local'}
                    key={item.attachmentId}
                  >
                    <div className="note-attachment-card__icon" aria-hidden="true">{attachmentIcon(item)}</div>
                    <div className="note-attachment-card__body">
                      <strong title={item.name}>{item.name}</strong>
                      <span>{formatAttachmentSize(item.byteLength)} · {attachmentTypeLabel(item)} · {attachmentLocationLabel(item)}</span>
                    </div>
                    <div className="note-attachment-card__actions">
                      <button
                        type="button"
                        onClick={() => void handleOpen(item)}
                        disabled={busy || remote}
                        title={unavailableTitle}
                      >Abrir</button>
                      <button
                        type="button"
                        onClick={() => void handleExport(item)}
                        disabled={busy || remote}
                        title={unavailableTitle}
                      >Exportar</button>
                      <button className="note-attachment-card__remove" type="button" onClick={() => void handleRemove(item)} disabled={busy}>Quitar</button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {loading && <p className="note-attachments__status">Cargando adjuntos cifrados…</p>}
          {status && <p className="note-attachments__status note-attachments__status--added" role="status">{status}</p>}
          {error && <p className="note-attachments__error" role="alert">{error}</p>}
          <p className="note-attachments__scope">
            Locales: incluidos en el backup cifrado. Grandes en Drive: el backup conserva referencia y manifiestos cifrados, no el contenido remoto.
          </p>
        </section>,
        targets.editorRoot,
      )}
    </>
  )
}
