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
import { exportRemoteLargeAttachment } from './largeAttachmentExportService'
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

const ATTACHMENT_TARGET_SELECTOR = [
  '.note-row--selected[data-reorder-note-id]',
  '.image-note-editor-root',
  '.editor-toolbar',
  '.editor-command-grid--insert',
].join(', ')

function elementTouchesAttachmentTargets(element: Element): boolean {
  return element.matches(ATTACHMENT_TARGET_SELECTOR) || Boolean(element.querySelector(ATTACHMENT_TARGET_SELECTOR))
}

function mutationTouchesAttachmentTargets(record: MutationRecord): boolean {
  if (!(record.target instanceof Element)) return false

  if (record.type === 'attributes') {
    if (elementTouchesAttachmentTargets(record.target)) return true
    if (record.target.matches('[data-reorder-note-id]')) {
      return record.oldValue?.includes('note-row--selected') === true
        || record.target.classList.contains('note-row--selected')
    }
    return false
  }

  return [...record.addedNodes, ...record.removedNodes].some((node) => (
    node instanceof Element && elementTouchesAttachmentTargets(node)
  ))
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

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  if (seconds < 1) return '<1 s'
  if (seconds < 60) return `~${Math.ceil(seconds)} s`
  const minutes = Math.ceil(seconds / 60)
  return `~${minutes} min`
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
  const statusTimerRef = useRef<number | null>(null)
  const recoveryAbortRef = useRef<AbortController | null>(null)
  const [targets, setTargets] = useState<AttachmentTargets>(() => currentTargets())
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([])
  const [newAttachmentIds, setNewAttachmentIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  function clearStatusTimer() {
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current)
      statusTimerRef.current = null
    }
  }

  function showTransientStatus(message: string, milliseconds = 2000) {
    clearStatusTimer()
    setStatus(message)
    statusTimerRef.current = window.setTimeout(() => {
      setStatus('')
      statusTimerRef.current = null
    }, milliseconds)
  }

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
    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    const observer = new MutationObserver((records) => {
      if (records.some(mutationTouchesAttachmentTargets)) refresh()
    })
    if (workspace) {
      observer.observe(workspace, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
        attributeOldValue: true,
      })
    }
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
    clearStatusTimer()
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
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current)
    recoveryAbortRef.current?.abort()
  }, [])

  function beginAttachmentSelection() {
    const noteId = currentNoteId()
    if (!noteId) {
      setError('Abre una nota antes de adjuntar un archivo.')
      return
    }

    pickerNoteIdRef.current = noteId
    clearStatusTimer()
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
    clearStatusTimer()
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
        showTransientStatus(
          files.length === 1
            ? remoteCount === 1 ? 'Archivo grande cifrado y guardado en Drive.' : 'Archivo agregado.'
            : `${files.length} archivos agregados · ${remoteCount} en Drive.`,
        )

        if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = window.setTimeout(() => {
          setNewAttachmentIds(new Set())
          highlightTimerRef.current = null
        }, 2000)
      }
    } catch (storeError) {
      setStatus('')
      setError(storeError instanceof Error ? storeError.message : 'No se pudo guardar el archivo cifrado.')
    } finally {
      setBusy(false)
    }
  }

  async function requireLocalAttachmentFile(item: AttachmentMetadata): Promise<File | null> {
    setError('')
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

  function cancelRecovery() {
    const controller = recoveryAbortRef.current
    if (!controller || controller.signal.aborted) return
    setStatus('Cancelando recuperación…')
    controller.abort()
  }

  async function recoverRemoteAttachment(item: AttachmentMetadata, openAfterSave: boolean): Promise<void> {
    clearStatusTimer()
    setError('')
    const controller = new AbortController()
    recoveryAbortRef.current = controller
    setRecovering(true)
    const startedAt = performance.now()
    setStatus(openAfterSave ? 'Preparando archivo grande para abrir…' : 'Preparando descarga del archivo grande…')

    try {
      const result = await exportRemoteLargeAttachment(item, {
        openAfterSave,
        signal: controller.signal,
        onProgress: ({ percent, recoveredPlaintextBytes, totalPlaintextBytes, waitingForNetwork }) => {
          if (controller.signal.aborted) return
          if (waitingForNetwork) {
            setStatus(`Sin conexión · esperando red… ${percent}%`)
            return
          }
          const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001)
          const bytesPerSecond = recoveredPlaintextBytes / elapsedSeconds
          const remainingBytes = Math.max(0, totalPlaintextBytes - recoveredPlaintextBytes)
          const eta = bytesPerSecond > 0 ? formatEta(remainingBytes / bytesPerSecond) : ''
          const detail = recoveredPlaintextBytes > 0
            ? ` · ${formatAttachmentSize(recoveredPlaintextBytes)} de ${formatAttachmentSize(totalPlaintextBytes)} · ${formatAttachmentSize(Math.round(bytesPerSecond))}/s${eta ? ` · ${eta}` : ''}`
            : ''
          setStatus(`${openAfterSave ? 'Recuperando' : 'Exportando'} desde Drive… ${percent}%${detail}`)
        },
      })

      if (result === 'cancelled') {
        showTransientStatus('Recuperación cancelada.')
        return
      }
      showTransientStatus(openAfterSave ? 'Archivo recuperado y abierto.' : 'Archivo recuperado y guardado.')
    } finally {
      if (recoveryAbortRef.current === controller) recoveryAbortRef.current = null
      setRecovering(false)
    }
  }

  async function handleOpen(item: AttachmentMetadata) {
    if (busy) return
    setBusy(true)
    try {
      if (isRemoteLargeAttachment(item)) {
        await recoverRemoteAttachment(item, true)
        return
      }

      const file = await requireLocalAttachmentFile(item)
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
    } catch (openError) {
      setStatus('')
      if (!(openError instanceof DOMException && openError.name === 'AbortError')) {
        setError(openError instanceof Error ? openError.message : 'No se pudo recuperar el archivo desde Drive.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleExport(item: AttachmentMetadata) {
    if (busy) return
    setBusy(true)
    try {
      if (isRemoteLargeAttachment(item)) {
        await recoverRemoteAttachment(item, false)
        return
      }

      const file = await requireLocalAttachmentFile(item)
      if (file) await shareOrDownloadFile(file)
    } catch (exportError) {
      setStatus('')
      if (!(exportError instanceof DOMException && exportError.name === 'AbortError')) {
        setError(exportError instanceof Error ? exportError.message : 'No se pudo exportar el archivo desde Drive.')
      }
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
                        disabled={busy}
                        title={remote ? 'Recuperar, descifrar y abrir desde Drive' : undefined}
                      >Abrir</button>
                      <button
                        type="button"
                        onClick={() => void handleExport(item)}
                        disabled={busy}
                        title={remote ? 'Recuperar y guardar desde Drive' : undefined}
                      >Exportar</button>
                      <button className="note-attachment-card__remove" type="button" onClick={() => void handleRemove(item)} disabled={busy}>Quitar</button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {loading && <p className="note-attachments__status">Cargando adjuntos cifrados…</p>}
          {status && (
            <div className="note-attachments__status-row" role="status">
              <p className="note-attachments__status note-attachments__status--added">{status}</p>
              {recovering && (
                <button className="note-attachments__cancel" type="button" onClick={cancelRecovery}>Cancelar</button>
              )}
            </div>
          )}
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