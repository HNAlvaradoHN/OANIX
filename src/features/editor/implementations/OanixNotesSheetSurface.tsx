import { useEffect, useRef, useState } from 'react'
import type {
  ClipboardEvent as ReactClipboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import type {
  EditorSurfaceAttachment,
  EditorSurfaceBlock,
  EditorSurfaceProps,
  EditorSurfaceSnapshot,
} from '../editorSurfaceContract'
import { findOanixClipboardImage } from '../oanixClipboardImage'
import {
  MAX_OANIX_FILE_GROUP_ITEMS,
  decodeOanixFileGroupElement,
  encodeOanixFileGroupElement,
} from '../oanixFileGroupElementCodec'
import {
  appendOanixFileGroupFiles,
  insertOanixFileGroup,
  type OanixFileGroupProgress,
} from '../oanixFileGroupLayer'
import {
  OANIX_IMAGE_BATCH_LIMIT,
  insertOanixImageBatch,
  type OanixImageBatchProgress,
} from '../oanixImageBatchInsertionCoordinator'
import { insertOanixCodeBlock } from '../oanixCodeBlockLayer'
import { insertOanixChecklistBlock } from '../oanixChecklistBlockLayer'
import { insertOanixContactBlock } from '../oanixContactBlockLayer'
import { insertOanixSeparatorBlock } from '../oanixSeparatorBlockLayer'
import { decideOanixMixedDocumentLoad } from '../oanixMixedDocumentLoadPolicy'
import { useDelayedOperationFeedback } from '../../../shared/useDelayedOperationFeedback'
import { OanixMixedDocumentWithFiles } from './OanixMixedDocumentWithFiles'
import './oanixNotesSheetSurface.css'

const AUTOSAVE_IDLE_MS = 3_000
const HANDLE_EDGE_PADDING = 48

type HandleSide = 'left' | 'right'
type DocumentMode = 'plain' | 'mixed'
type MixedCursorTarget = { blockId: string; cursorOffset: number }

function snapshotsMatch(left: EditorSurfaceSnapshot, right: EditorSurfaceSnapshot): boolean {
  return left.title === right.title && left.text === right.text
}

function Icon({ children, width = 18, height = 18 }: { children: ReactNode; width?: number; height?: number }) {
  return <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

function imageProgressLabel(progress: OanixImageBatchProgress | null, stillRunning: boolean): string {
  if (!progress) return stillRunning ? 'Todavía procesando imágenes…' : 'Procesando imágenes…'
  const prefix = stillRunning ? 'Todavía ' : ''
  if (progress.stage === 'committing') {
    return `${prefix}insertando ${progress.total === 1 ? 'imagen' : `${progress.total} imágenes`}…`
  }
  if (progress.completed <= 0) {
    return `${prefix}cifrando ${progress.total === 1 ? 'imagen' : `${progress.total} imágenes`}…`
  }
  return `${prefix}cifrando imágenes ${progress.completed}/${progress.total}…`
}

function fileProgressLabel(progress: OanixFileGroupProgress | null): string {
  if (!progress) return 'Procesando archivos…'
  if (progress.stage === 'committing') return 'Guardando tarjeta de archivos…'
  if (progress.total === 1) return progress.completed > 0 ? 'Guardando archivo…' : 'Cifrando archivo…'
  return `Cifrando archivos ${progress.completed}/${progress.total}…`
}

export function OanixNotesSheetSurface({
  noteId,
  initialTitle,
  initialText,
  saving,
  error = '',
  onRequestSave,
  onRequestClose,
  loadBlocks,
  onRequestBlockSave,
  loadAttachments,
  onRequestAttachmentStore,
  loadAttachmentFile,
  onRequestAttachmentRemove,
  onActivity,
}: EditorSurfaceProps) {
  const titleRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<HTMLElement | null>(null)
  const dirtyRef = useRef(false)
  const generationRef = useRef(0)
  const lastActivityAtRef = useRef(0)
  const composingRef = useRef(false)
  const closingRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef<Promise<boolean> | null>(null)
  const committedSnapshotRef = useRef<EditorSurfaceSnapshot>({ title: initialTitle, text: initialText })
  const handleDragRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)
  const lastPlainCursorRef = useRef(initialText.length)
  const pendingImageCursorRef = useRef<number | null>(null)
  const pendingMixedImageTargetRef = useRef<MixedCursorTarget | null>(null)
  const pendingFileCursorRef = useRef<number | null>(null)
  const pendingMixedFileTargetRef = useRef<MixedCursorTarget | null>(null)
  const pendingFileGroupBlockIdRef = useRef<string | null>(null)
  const pendingMixedUpsertsRef = useRef<Map<string, EditorSurfaceBlock>>(new Map())

  const [dirty, setDirty] = useState(false)
  const [closing, setClosing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [theme, setTheme] = useState('default')
  const [mode, setMode] = useState<'light' | 'dark' | 'auto'>('light')
  const [handleSide, setHandleSide] = useState<HandleSide>('right')
  const [handleY, setHandleY] = useState(0.5)
  const [documentMode, setDocumentMode] = useState<DocumentMode>('plain')
  const [mixedBlocks, setMixedBlocks] = useState<EditorSurfaceBlock[]>([])
  const [attachments, setAttachments] = useState<EditorSurfaceAttachment[]>([])
  const [metadataReady, setMetadataReady] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageProgress, setImageProgress] = useState<OanixImageBatchProgress | null>(null)
  const [fileBusy, setFileBusy] = useState(false)
  const [fileProgress, setFileProgress] = useState<OanixFileGroupProgress | null>(null)
  const [codeBusy, setCodeBusy] = useState(false)
  const [checklistBusy, setChecklistBusy] = useState(false)
  const [contactBusy, setContactBusy] = useState(false)
  const [separatorBusy, setSeparatorBusy] = useState(false)
  const [integrationError, setIntegrationError] = useState('')
  const imageFeedback = useDelayedOperationFeedback()

  const mixedAvailable = Boolean(
    loadBlocks
    && onRequestBlockSave
    && loadAttachments
    && onRequestAttachmentStore
    && loadAttachmentFile
    && onRequestAttachmentRemove,
  )

  function readSnapshot(): EditorSurfaceSnapshot {
    return {
      title: titleRef.current?.value ?? initialTitle,
      text: documentMode === 'mixed' ? '' : bodyRef.current?.value ?? initialText,
    }
  }

  function resizeBody() {
    const textarea = bodyRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(280, textarea.scrollHeight)}px`
  }

  function rememberPlainCursor() {
    const textarea = bodyRef.current
    if (!textarea) return
    lastPlainCursorRef.current = Math.max(0, textarea.selectionStart ?? textarea.value.length)
  }

  function currentMixedCursor(): MixedCursorTarget | null {
    const active = document.activeElement
    if (!(active instanceof HTMLTextAreaElement) || !active.matches('.oanix-mixed-document__text')) return null
    const blockId = active.dataset.oanixMixedTextId
    if (!blockId) return null
    return {
      blockId,
      cursorOffset: Math.max(0, active.selectionStart ?? active.value.length),
    }
  }

  function fallbackMixedCursor(): MixedCursorTarget | null {
    const textareas = editorRef.current?.querySelectorAll<HTMLTextAreaElement>('.oanix-mixed-document__text')
    const fallback = textareas?.[Math.max(0, (textareas?.length ?? 1) - 1)]
    const blockId = fallback?.dataset.oanixMixedTextId
    if (!fallback || !blockId) return null
    return { blockId, cursorOffset: fallback.value.length }
  }

  function rememberMixedCursor(blockId: string, cursorOffset: number) {
    pendingMixedImageTargetRef.current = {
      blockId,
      cursorOffset: Math.max(0, cursorOffset),
    }
  }

  function rememberMixedCursorFromActiveElement() {
    const target = currentMixedCursor()
    if (target) pendingMixedImageTargetRef.current = target
  }

  function resolveMixedInsertionTarget(): MixedCursorTarget | null {
    const current = currentMixedCursor()
    if (current) {
      rememberMixedCursor(current.blockId, current.cursorOffset)
      return current
    }
    return pendingMixedImageTargetRef.current ?? fallbackMixedCursor()
  }

  function clearIdleTimer() {
    if (idleTimerRef.current === null) return
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }

  function markClean() {
    dirtyRef.current = false
    setDirty(false)
  }

  function armAutosaveTimer() {
    clearIdleTimer()
    if (!dirtyRef.current || closingRef.current || composingRef.current) return
    const elapsed = Math.max(0, Date.now() - lastActivityAtRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      void runAutosaveIfIdle()
    }, Math.max(0, AUTOSAVE_IDLE_MS - elapsed))
  }

  async function saveCurrentSnapshot(): Promise<boolean> {
    if (!dirtyRef.current) return true
    if (saveInFlightRef.current) return saveInFlightRef.current

    const generation = generationRef.current
    const snapshot = readSnapshot()
    const stagedBlocks = documentMode === 'mixed'
      ? [...pendingMixedUpsertsRef.current.values()]
      : []
    const snapshotChanged = !snapshotsMatch(snapshot, committedSnapshotRef.current)

    if (!snapshotChanged && stagedBlocks.length === 0) {
      markClean()
      return true
    }

    const operation = (async () => {
      if (stagedBlocks.length > 0) {
        if (!onRequestBlockSave) return false
        let blocksSaved = false
        try {
          blocksSaved = await onRequestBlockSave({ upserts: stagedBlocks })
        } catch {
          blocksSaved = false
        }
        if (!blocksSaved) return false
        for (const block of stagedBlocks) {
          if (pendingMixedUpsertsRef.current.get(block.id) === block) {
            pendingMixedUpsertsRef.current.delete(block.id)
          }
        }
      }

      if (snapshotChanged) {
        let snapshotSaved = false
        try {
          snapshotSaved = await onRequestSave(snapshot)
        } catch {
          snapshotSaved = false
        }
        if (!snapshotSaved) return false
        committedSnapshotRef.current = snapshot
      }

      return true
    })()
    saveInFlightRef.current = operation

    try {
      const succeeded = await operation
      if (succeeded && generationRef.current === generation && pendingMixedUpsertsRef.current.size === 0) {
        markClean()
      }
      return succeeded
    } finally {
      if (saveInFlightRef.current === operation) saveInFlightRef.current = null
      if (dirtyRef.current && generationRef.current !== generation && !closingRef.current) armAutosaveTimer()
    }
  }

  async function runAutosaveIfIdle() {
    if (!dirtyRef.current || closingRef.current || composingRef.current) return
    if (saveInFlightRef.current) {
      await saveInFlightRef.current
      if (dirtyRef.current && !closingRef.current) armAutosaveTimer()
      return
    }
    if (Date.now() - lastActivityAtRef.current < AUTOSAVE_IDLE_MS) {
      armAutosaveTimer()
      return
    }
    await saveCurrentSnapshot()
  }

  function markActivity() {
    onActivity?.()
    generationRef.current += 1
    lastActivityAtRef.current = Date.now()
    if (!dirtyRef.current) {
      dirtyRef.current = true
      setDirty(true)
    }
    armAutosaveTimer()
  }

  function handleBodyInput() {
    resizeBody()
    rememberPlainCursor()
    markActivity()
  }

  function stageMixedBlock(block: EditorSurfaceBlock) {
    pendingMixedUpsertsRef.current.set(block.id, block)
  }

  async function requestClose() {
    if (saving || imageBusy || fileBusy || codeBusy || checklistBusy || contactBusy || separatorBusy || closingRef.current) return
    closingRef.current = true
    setClosing(true)
    clearIdleTimer()

    let closed = false
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current

      if (documentMode === 'mixed') {
        if (dirtyRef.current && !(await saveCurrentSnapshot())) return
        closed = await onRequestClose(null)
      } else {
        const snapshot = readSnapshot()
        closed = snapshotsMatch(snapshot, committedSnapshotRef.current)
          ? await onRequestClose(null)
          : await onRequestClose(snapshot)
        if (closed) committedSnapshotRef.current = snapshot
      }

      if (closed) markClean()
    } finally {
      if (!closed) {
        closingRef.current = false
        setClosing(false)
        if (dirtyRef.current) armAutosaveTimer()
      }
    }
  }

  function runNativeHistory(command: 'undo' | 'redo') {
    const active = document.activeElement
    if (!(active instanceof HTMLTextAreaElement) && active !== titleRef.current) {
      if (documentMode === 'plain') bodyRef.current?.focus()
      else editorRef.current?.querySelector<HTMLTextAreaElement>('.oanix-mixed-document__text')?.focus()
    }
    document.execCommand(command)
    window.requestAnimationFrame(() => {
      if (documentMode === 'plain') resizeBody()
    })
  }

  function closeKeyboard() {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }

  function closeCustomize() {
    const active = document.activeElement
    if (active instanceof HTMLElement && active.closest('.oanix-notes__customize')) active.blur()
    setCustomizeOpen(false)
  }

  function closeCustomizeFromPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    closeCustomize()
  }

  function openPanel() {
    if (documentMode === 'plain') rememberPlainCursor()
    else rememberMixedCursorFromActiveElement()
    closeKeyboard()
    closeCustomize()
    setPanelOpen(true)
  }

  function openCustomize() {
    closeKeyboard()
    setPanelOpen(false)
    setCustomizeOpen(true)
  }

  function applyMode(nextMode: 'light' | 'dark' | 'auto') {
    setMode(nextMode)
    if (nextMode === 'dark') setTheme('dark')
    if (nextMode === 'light' && (theme === 'dark' || theme === 'midnight')) setTheme('default')
    if (nextMode === 'auto') {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
      setTheme(prefersDark ? 'dark' : 'default')
    }
  }

  function updateFloatingHandle(clientX: number, clientY: number) {
    const editor = editorRef.current
    if (!editor) return
    const bounds = editor.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    const localY = Math.min(
      Math.max(clientY - bounds.top, HANDLE_EDGE_PADDING),
      Math.max(HANDLE_EDGE_PADDING, bounds.height - HANDLE_EDGE_PADDING),
    )
    setHandleY(localY / bounds.height)
    setHandleSide(clientX - bounds.left < bounds.width / 2 ? 'left' : 'right')
  }

  function handleFloatingPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (panelOpen) return
    handleDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleFloatingPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = handleDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true
    if (!drag.moved) return
    event.preventDefault()
    updateFloatingHandle(event.clientX, event.clientY)
  }

  function finishFloatingPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = handleDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const shouldOpen = !drag.moved
    handleDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (shouldOpen) openPanel()
  }

  function focusAfterInsertedElement(elementBlockId: string, afterTextBlockId: string) {
    window.requestAnimationFrame(() => {
      const element = editorRef.current?.querySelector<HTMLElement>(`[data-oanix-element-id="${CSS.escape(elementBlockId)}"]`)
      element?.scrollIntoView({ block: 'center' })
      const nextText = editorRef.current?.querySelector<HTMLTextAreaElement>(`[data-oanix-mixed-text-id="${CSS.escape(afterTextBlockId)}"]`)
      nextText?.focus({ preventScroll: true })
      nextText?.setSelectionRange(0, 0)
      if (nextText) rememberMixedCursor(afterTextBlockId, 0)
    })
  }

  function mergeAttachments(inserted: readonly EditorSurfaceAttachment[]) {
    setAttachments((current) => {
      const insertedIds = new Set(inserted.map((item) => item.id))
      return [...current.filter((item) => !insertedIds.has(item.id)), ...inserted]
    })
  }

  function beginImageBatch(total: number) {
    setImageBusy(true)
    setImageProgress({ stage: 'storing', completed: 0, total })
    imageFeedback.start()
    setPanelOpen(false)
    setIntegrationError('')
    clearIdleTimer()
  }

  function finishImageBatch() {
    imageFeedback.finish()
    setImageProgress(null)
    setImageBusy(false)
  }

  async function insertImageFiles(files: readonly File[], cursorOffset: number) {
    if (
      documentMode !== 'plain'
      || !metadataReady
      || !loadBlocks
      || !onRequestBlockSave
      || !onRequestAttachmentStore
      || !onRequestAttachmentRemove
    ) {
      setIntegrationError('Imagen todavía no está disponible en el estado actual de esta nota.')
      return
    }
    if (files.length < 1) return
    if (files.length > OANIX_IMAGE_BATCH_LIMIT) {
      setIntegrationError(`Puedes seleccionar hasta ${OANIX_IMAGE_BATCH_LIMIT} imágenes por vez.`)
      return
    }

    beginImageBatch(files.length)

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      const textarea = bodyRef.current
      const text = textarea?.value ?? initialText
      const title = titleRef.current?.value ?? initialTitle
      const safeCursor = Math.min(Math.max(0, cursorOffset), text.length)
      const existingBlocks = await loadBlocks()
      const result = await insertOanixImageBatch({
        mode: 'plain',
        files,
        title,
        text,
        cursorOffset: safeCursor,
        existingBlocks,
        storeAttachment: onRequestAttachmentStore,
        saveBlockChanges: onRequestBlockSave,
        savePlainSnapshot: onRequestSave,
        removeAttachment: onRequestAttachmentRemove,
        onProgress: setImageProgress,
      })

      if (result.status !== 'committed') {
        setIntegrationError(`No se pudieron insertar las imágenes de forma segura (${result.status}).`)
        if (dirtyRef.current) armAutosaveTimer()
        return
      }

      pendingMixedUpsertsRef.current.clear()
      if (textarea) textarea.value = ''
      committedSnapshotRef.current = { title, text: '' }
      setMixedBlocks(result.plan.blocks)
      mergeAttachments(result.attachments)
      setDocumentMode('mixed')
      markClean()
      onActivity?.()

      const lastImageId = result.plan.imageBlockIds.at(-1)
      if (lastImageId) focusAfterInsertedElement(lastImageId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudieron insertar las imágenes de forma segura.')
      if (dirtyRef.current) armAutosaveTimer()
    } finally {
      finishImageBatch()
    }
  }

  async function insertMixedImageFiles(files: readonly File[], blockId: string, cursorOffset: number) {
    if (
      documentMode !== 'mixed'
      || !metadataReady
      || !loadBlocks
      || !onRequestBlockSave
      || !onRequestAttachmentStore
      || !onRequestAttachmentRemove
    ) {
      setIntegrationError('Imagen todavía no está disponible en el estado actual de esta nota.')
      return
    }
    if (files.length < 1) return
    if (files.length > OANIX_IMAGE_BATCH_LIMIT) {
      setIntegrationError(`Puedes seleccionar hasta ${OANIX_IMAGE_BATCH_LIMIT} imágenes por vez.`)
      return
    }

    beginImageBatch(files.length)

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el texto pendiente antes de insertar las imágenes.')
        return
      }

      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixImageBatch({
        mode: 'mixed',
        files,
        blocks: confirmedBlocks,
        targetTextBlockId: blockId,
        cursorOffset,
        storeAttachment: onRequestAttachmentStore,
        saveBlockChanges: onRequestBlockSave,
        removeAttachment: onRequestAttachmentRemove,
        onProgress: setImageProgress,
      })

      if (result.status !== 'committed') {
        setIntegrationError(`No se pudieron insertar las imágenes de forma segura (${result.status}).`)
        return
      }

      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      mergeAttachments(result.attachments)
      markClean()
      onActivity?.()
      const lastImageId = result.plan.imageBlockIds.at(-1)
      if (lastImageId) focusAfterInsertedElement(lastImageId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudieron insertar las imágenes de forma segura.')
    } finally {
      finishImageBatch()
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  function openImagePicker() {
    if (!metadataReady || !mixedAvailable) {
      setIntegrationError('Imagen todavía no está disponible en el estado actual de esta nota.')
      return
    }

    if (documentMode === 'plain') {
      rememberPlainCursor()
      pendingImageCursorRef.current = lastPlainCursorRef.current
      pendingMixedImageTargetRef.current = null
    } else {
      const target = resolveMixedInsertionTarget()
      if (!target) {
        setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar la imagen.')
        return
      }
      pendingMixedImageTargetRef.current = target
      pendingImageCursorRef.current = null
    }

    imageInputRef.current?.click()
  }

  function beginFileOperation(total: number) {
    setFileBusy(true)
    setFileProgress({ stage: 'storing', completed: 0, total })
    setPanelOpen(false)
    setIntegrationError('')
    clearIdleTimer()
  }

  function finishFileOperation() {
    setFileProgress(null)
    setFileBusy(false)
  }

  async function insertFileGroupFiles(files: readonly File[], cursorOffset: number) {
    if (
      documentMode !== 'plain'
      || !metadataReady
      || !loadBlocks
      || !onRequestBlockSave
      || !onRequestAttachmentStore
      || !onRequestAttachmentRemove
    ) {
      setIntegrationError('Archivos todavía no está disponible en el estado actual de esta nota.')
      return
    }
    if (files.length < 1 || files.length > MAX_OANIX_FILE_GROUP_ITEMS) {
      setIntegrationError(`Puedes seleccionar hasta ${MAX_OANIX_FILE_GROUP_ITEMS} archivos por tarjeta.`)
      return
    }

    beginFileOperation(files.length)
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      const textarea = bodyRef.current
      const text = textarea?.value ?? initialText
      const title = titleRef.current?.value ?? initialTitle
      const safeCursor = Math.min(Math.max(0, cursorOffset), text.length)
      const existingBlocks = await loadBlocks()
      const result = await insertOanixFileGroup({
        mode: 'plain',
        files,
        title,
        text,
        cursorOffset: safeCursor,
        existingBlocks,
        storeAttachment: onRequestAttachmentStore,
        saveBlockChanges: onRequestBlockSave,
        savePlainSnapshot: onRequestSave,
        removeAttachment: onRequestAttachmentRemove,
        onProgress: setFileProgress,
      })

      if (result.status !== 'committed') {
        setIntegrationError(`No se pudo crear la tarjeta de archivos de forma segura (${result.status}).`)
        return
      }

      pendingMixedUpsertsRef.current.clear()
      if (textarea) textarea.value = ''
      committedSnapshotRef.current = { title, text: '' }
      setMixedBlocks(result.plan.blocks)
      mergeAttachments(result.attachments)
      setDocumentMode('mixed')
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.groupBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo crear la tarjeta de archivos de forma segura.')
    } finally {
      finishFileOperation()
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function insertMixedFileGroupFiles(files: readonly File[], blockId: string, cursorOffset: number) {
    if (
      documentMode !== 'mixed'
      || !metadataReady
      || !loadBlocks
      || !onRequestBlockSave
      || !onRequestAttachmentStore
      || !onRequestAttachmentRemove
    ) {
      setIntegrationError('Archivos todavía no está disponible en el estado actual de esta nota.')
      return
    }
    if (files.length < 1 || files.length > MAX_OANIX_FILE_GROUP_ITEMS) {
      setIntegrationError(`Puedes seleccionar hasta ${MAX_OANIX_FILE_GROUP_ITEMS} archivos por tarjeta.`)
      return
    }

    beginFileOperation(files.length)
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el texto pendiente antes de insertar la tarjeta de archivos.')
        return
      }
      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixFileGroup({
        mode: 'mixed',
        files,
        blocks: confirmedBlocks,
        targetTextBlockId: blockId,
        cursorOffset,
        storeAttachment: onRequestAttachmentStore,
        saveBlockChanges: onRequestBlockSave,
        removeAttachment: onRequestAttachmentRemove,
        onProgress: setFileProgress,
      })

      if (result.status !== 'committed') {
        setIntegrationError(`No se pudo crear la tarjeta de archivos de forma segura (${result.status}).`)
        return
      }
      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      mergeAttachments(result.attachments)
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.groupBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo crear la tarjeta de archivos de forma segura.')
    } finally {
      finishFileOperation()
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function appendFilesToGroup(groupBlockId: string, files: readonly File[]) {
    if (
      documentMode !== 'mixed'
      || !onRequestBlockSave
      || !onRequestAttachmentStore
      || !onRequestAttachmentRemove
    ) return
    if (files.length < 1) return
    const currentBlock = mixedBlocks.find((block) => block.id === groupBlockId)
    const group = currentBlock ? decodeOanixFileGroupElement(currentBlock) : null
    if (!currentBlock || !group) {
      setIntegrationError('La tarjeta de archivos ya no está disponible.')
      return
    }
    if (group.attachmentIds.length + files.length > MAX_OANIX_FILE_GROUP_ITEMS) {
      setIntegrationError(`Una tarjeta puede contener hasta ${MAX_OANIX_FILE_GROUP_ITEMS} archivos.`)
      return
    }

    beginFileOperation(files.length)
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el texto pendiente antes de añadir archivos.')
        return
      }
      const result = await appendOanixFileGroupFiles({
        groupBlock: currentBlock,
        files,
        storeAttachment: onRequestAttachmentStore,
        saveBlockChanges: onRequestBlockSave,
        removeAttachment: onRequestAttachmentRemove,
        onProgress: setFileProgress,
      })
      if (result.status !== 'committed') {
        setIntegrationError(`No se pudieron añadir los archivos de forma segura (${result.status}).`)
        return
      }
      setMixedBlocks((current) => current.map((block) => block.id === groupBlockId ? result.block : block))
      mergeAttachments(result.attachments)
      onActivity?.()
    } catch {
      setIntegrationError('No se pudieron añadir los archivos a la tarjeta.')
    } finally {
      finishFileOperation()
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  function openFilePicker(groupBlockId?: string) {
    if (!metadataReady || !mixedAvailable || fileBusy || imageBusy) {
      setIntegrationError('Archivos todavía no está disponible en el estado actual de esta nota.')
      return
    }

    pendingFileGroupBlockIdRef.current = groupBlockId ?? null
    pendingFileCursorRef.current = null
    pendingMixedFileTargetRef.current = null

    if (!groupBlockId) {
      if (documentMode === 'plain') {
        rememberPlainCursor()
        pendingFileCursorRef.current = lastPlainCursorRef.current
      } else {
        const target = resolveMixedInsertionTarget()
        if (!target) {
          setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar la tarjeta de archivos.')
          return
        }
        pendingMixedFileTargetRef.current = target
      }
    }

    setPanelOpen(false)
    fileInputRef.current?.click()
  }

  async function insertCodeBlockFromMenu() {
    if (!metadataReady || !loadBlocks || !onRequestBlockSave || codeBusy || imageBusy || fileBusy) {
      setIntegrationError('Código todavía no está disponible en el estado actual de esta nota.')
      return
    }

    setPanelOpen(false)
    setCodeBusy(true)
    setIntegrationError('')
    clearIdleTimer()

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current

      if (documentMode === 'plain') {
        const textarea = bodyRef.current
        const text = textarea?.value ?? initialText
        const title = titleRef.current?.value ?? initialTitle
        const existingBlocks = await loadBlocks()
        const result = await insertOanixCodeBlock({
          mode: 'plain',
          title,
          text,
          cursorOffset: lastPlainCursorRef.current,
          existingBlocks,
          saveBlockChanges: onRequestBlockSave,
          savePlainSnapshot: onRequestSave,
        })

        if (result.status !== 'committed') {
          setIntegrationError(`No se pudo insertar el bloque de código de forma segura (${result.status}).`)
          return
        }

        pendingMixedUpsertsRef.current.clear()
        if (textarea) textarea.value = ''
        committedSnapshotRef.current = { title, text: '' }
        setMixedBlocks(result.plan.blocks)
        setDocumentMode('mixed')
        markClean()
        onActivity?.()
        focusAfterInsertedElement(result.plan.codeBlockId, result.plan.afterTextBlockId)
        return
      }

      const target = resolveMixedInsertionTarget()
      pendingMixedImageTargetRef.current = null
      if (!target) {
        setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar el bloque de código.')
        return
      }
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de insertar el bloque de código.')
        return
      }

      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixCodeBlock({
        mode: 'mixed',
        blocks: confirmedBlocks,
        targetTextBlockId: target.blockId,
        cursorOffset: target.cursorOffset,
        saveBlockChanges: onRequestBlockSave,
      })

      if (result.status !== 'committed') {
        setIntegrationError(`No se pudo insertar el bloque de código de forma segura (${result.status}).`)
        return
      }

      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.codeBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo insertar el bloque de código de forma segura.')
    } finally {
      setCodeBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeCodeBlock(blockId: string) {
    if (!onRequestBlockSave || codeBusy || imageBusy || fileBusy) return
    setCodeBusy(true)
    setIntegrationError('')
    clearIdleTimer()

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de eliminar el bloque de código.')
        return
      }

      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removed = await onRequestBlockSave({
        deletes: [blockId],
        order: nextBlocks.map((block) => block.id),
      })
      if (!removed) {
        setIntegrationError('No se pudo eliminar el bloque de código.')
        return
      }

      pendingMixedUpsertsRef.current.delete(blockId)
      setMixedBlocks(nextBlocks)
      markClean()
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar el bloque de código.')
    } finally {
      setCodeBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function insertChecklistBlockFromMenu() {
    if (!metadataReady || !loadBlocks || !onRequestBlockSave || checklistBusy || codeBusy || imageBusy || fileBusy) {
      setIntegrationError('Checklist todavía no está disponible en el estado actual de esta nota.')
      return
    }

    setPanelOpen(false)
    setChecklistBusy(true)
    setIntegrationError('')
    clearIdleTimer()

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current

      if (documentMode === 'plain') {
        const textarea = bodyRef.current
        const text = textarea?.value ?? initialText
        const title = titleRef.current?.value ?? initialTitle
        const existingBlocks = await loadBlocks()
        const result = await insertOanixChecklistBlock({
          mode: 'plain',
          title,
          text,
          cursorOffset: lastPlainCursorRef.current,
          existingBlocks,
          saveBlockChanges: onRequestBlockSave,
          savePlainSnapshot: onRequestSave,
        })

        if (result.status !== 'committed') {
          setIntegrationError(`No se pudo insertar la checklist de forma segura (${result.status}).`)
          return
        }

        pendingMixedUpsertsRef.current.clear()
        if (textarea) textarea.value = ''
        committedSnapshotRef.current = { title, text: '' }
        setMixedBlocks(result.plan.blocks)
        setDocumentMode('mixed')
        markClean()
        onActivity?.()
        focusAfterInsertedElement(result.plan.checklistBlockId, result.plan.afterTextBlockId)
        return
      }

      const target = resolveMixedInsertionTarget()
      pendingMixedImageTargetRef.current = null
      if (!target) {
        setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar la checklist.')
        return
      }
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de insertar la checklist.')
        return
      }

      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixChecklistBlock({
        mode: 'mixed',
        blocks: confirmedBlocks,
        targetTextBlockId: target.blockId,
        cursorOffset: target.cursorOffset,
        saveBlockChanges: onRequestBlockSave,
      })

      if (result.status !== 'committed') {
        setIntegrationError(`No se pudo insertar la checklist de forma segura (${result.status}).`)
        return
      }

      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.checklistBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo insertar la checklist de forma segura.')
    } finally {
      setChecklistBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeChecklistBlock(blockId: string) {
    if (!onRequestBlockSave || checklistBusy || codeBusy || imageBusy || fileBusy) return
    setChecklistBusy(true)
    setIntegrationError('')
    clearIdleTimer()

    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de eliminar la checklist.')
        return
      }

      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removed = await onRequestBlockSave({
        deletes: [blockId],
        order: nextBlocks.map((block) => block.id),
      })
      if (!removed) {
        setIntegrationError('No se pudo eliminar la checklist.')
        return
      }

      pendingMixedUpsertsRef.current.delete(blockId)
      setMixedBlocks(nextBlocks)
      markClean()
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar la checklist.')
    } finally {
      setChecklistBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function insertContactBlockFromMenu() {
    if (!metadataReady || !loadBlocks || !onRequestBlockSave || contactBusy || checklistBusy || codeBusy || imageBusy || fileBusy) {
      setIntegrationError('Contacto todavía no está disponible en el estado actual de esta nota.')
      return
    }
    setPanelOpen(false)
    setContactBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (documentMode === 'plain') {
        const textarea = bodyRef.current
        const text = textarea?.value ?? initialText
        const title = titleRef.current?.value ?? initialTitle
        const existingBlocks = await loadBlocks()
        const result = await insertOanixContactBlock({
          mode: 'plain', title, text, cursorOffset: lastPlainCursorRef.current, existingBlocks,
          saveBlockChanges: onRequestBlockSave, savePlainSnapshot: onRequestSave,
        })
        if (result.status !== 'committed') {
          setIntegrationError(`No se pudo insertar el contacto de forma segura (${result.status}).`)
          return
        }
        pendingMixedUpsertsRef.current.clear()
        if (textarea) textarea.value = ''
        committedSnapshotRef.current = { title, text: '' }
        setMixedBlocks(result.plan.blocks)
        setDocumentMode('mixed')
        markClean()
        onActivity?.()
        focusAfterInsertedElement(result.plan.contactBlockId, result.plan.afterTextBlockId)
        return
      }
      const target = resolveMixedInsertionTarget()
      pendingMixedImageTargetRef.current = null
      if (!target) {
        setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar el contacto.')
        return
      }
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de insertar el contacto.')
        return
      }
      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixContactBlock({
        mode: 'mixed', blocks: confirmedBlocks, targetTextBlockId: target.blockId,
        cursorOffset: target.cursorOffset, saveBlockChanges: onRequestBlockSave,
      })
      if (result.status !== 'committed') {
        setIntegrationError(`No se pudo insertar el contacto de forma segura (${result.status}).`)
        return
      }
      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.contactBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo insertar el contacto de forma segura.')
    } finally {
      setContactBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeContactBlock(blockId: string) {
    if (!onRequestBlockSave || contactBusy || checklistBusy || codeBusy || imageBusy || fileBusy) return
    setContactBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de eliminar el contacto.')
        return
      }
      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removed = await onRequestBlockSave({ deletes: [blockId], order: nextBlocks.map((block) => block.id) })
      if (!removed) {
        setIntegrationError('No se pudo eliminar el contacto.')
        return
      }
      pendingMixedUpsertsRef.current.delete(blockId)
      setMixedBlocks(nextBlocks)
      markClean()
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar el contacto.')
    } finally {
      setContactBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function insertSeparatorBlockFromMenu() {
    if (!metadataReady || !loadBlocks || !onRequestBlockSave || separatorBusy || contactBusy || checklistBusy || codeBusy || imageBusy || fileBusy) {
      setIntegrationError('Separador todavía no está disponible en el estado actual de esta nota.')
      return
    }
    setPanelOpen(false)
    setSeparatorBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (documentMode === 'plain') {
        const textarea = bodyRef.current
        const text = textarea?.value ?? initialText
        const title = titleRef.current?.value ?? initialTitle
        const existingBlocks = await loadBlocks()
        const result = await insertOanixSeparatorBlock({
          mode: 'plain',
          title,
          text,
          cursorOffset: lastPlainCursorRef.current,
          existingBlocks,
          saveBlockChanges: onRequestBlockSave,
          savePlainSnapshot: onRequestSave,
        })
        if (result.status !== 'committed') {
          setIntegrationError(`No se pudo insertar el separador de forma segura (${result.status}).`)
          return
        }
        pendingMixedUpsertsRef.current.clear()
        if (textarea) textarea.value = ''
        committedSnapshotRef.current = { title, text: '' }
        setMixedBlocks(result.plan.blocks)
        setDocumentMode('mixed')
        markClean()
        onActivity?.()
        focusAfterInsertedElement(result.plan.separatorBlockId, result.plan.afterTextBlockId)
        return
      }

      const target = resolveMixedInsertionTarget()
      pendingMixedImageTargetRef.current = null
      if (!target) {
        setIntegrationError('Coloca el cursor en un tramo de texto antes de insertar el separador.')
        return
      }
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de insertar el separador.')
        return
      }
      const confirmedBlocks = await loadBlocks()
      const result = await insertOanixSeparatorBlock({
        mode: 'mixed',
        blocks: confirmedBlocks,
        targetTextBlockId: target.blockId,
        cursorOffset: target.cursorOffset,
        saveBlockChanges: onRequestBlockSave,
      })
      if (result.status !== 'committed') {
        setIntegrationError(`No se pudo insertar el separador de forma segura (${result.status}).`)
        return
      }
      pendingMixedUpsertsRef.current.clear()
      setMixedBlocks(result.plan.blocks)
      markClean()
      onActivity?.()
      focusAfterInsertedElement(result.plan.separatorBlockId, result.plan.afterTextBlockId)
    } catch {
      setIntegrationError('No se pudo insertar el separador de forma segura.')
    } finally {
      setSeparatorBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeSeparatorBlock(blockId: string) {
    if (!onRequestBlockSave || separatorBusy || contactBusy || checklistBusy || codeBusy || imageBusy || fileBusy) return
    setSeparatorBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (saveInFlightRef.current) await saveInFlightRef.current
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de eliminar el separador.')
        return
      }
      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removed = await onRequestBlockSave({ deletes: [blockId], order: nextBlocks.map((block) => block.id) })
      if (!removed) {
        setIntegrationError('No se pudo eliminar el separador.')
        return
      }
      pendingMixedUpsertsRef.current.delete(blockId)
      setMixedBlocks(nextBlocks)
      markClean()
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar el separador.')
    } finally {
      setSeparatorBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  function handlePlainPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const file = findOanixClipboardImage(event.clipboardData)
    if (!file) return
    if (!metadataReady || !mixedAvailable || imageBusy || fileBusy) return
    event.preventDefault()
    const cursor = Math.max(0, event.currentTarget.selectionStart ?? event.currentTarget.value.length)
    lastPlainCursorRef.current = cursor
    void insertImageFiles([file], cursor)
  }

  async function removeMixedImage(blockId: string, attachmentId: string) {
    if (!onRequestBlockSave || !onRequestAttachmentRemove || imageBusy || fileBusy) return
    setImageBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el texto pendiente antes de eliminar la imagen.')
        return
      }
      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removedFromDocument = await onRequestBlockSave({
        deletes: [blockId],
        order: nextBlocks.map((block) => block.id),
      })
      if (!removedFromDocument) {
        setIntegrationError('No se pudo eliminar la referencia de la imagen.')
        return
      }

      setMixedBlocks(nextBlocks)
      const removedAsset = await onRequestAttachmentRemove(attachmentId)
      if (removedAsset) {
        setAttachments((current) => current.filter((item) => item.id !== attachmentId))
      } else {
        setIntegrationError('La imagen se quitó de la nota, pero su asset cifrado quedó pendiente de limpieza.')
      }
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar la imagen.')
    } finally {
      setImageBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeFileFromGroup(blockId: string, attachmentId: string) {
    if (!onRequestBlockSave || !onRequestAttachmentRemove || fileBusy || imageBusy) return
    const currentBlock = mixedBlocks.find((block) => block.id === blockId)
    const group = currentBlock ? decodeOanixFileGroupElement(currentBlock) : null
    if (!group || !group.attachmentIds.includes(attachmentId)) return

    setFileBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el texto pendiente antes de quitar el archivo.')
        return
      }
      const nextBlock = encodeOanixFileGroupElement({
        ...group,
        attachmentIds: group.attachmentIds.filter((id) => id !== attachmentId),
      })
      const saved = await onRequestBlockSave({ upserts: [nextBlock] })
      if (!saved) {
        setIntegrationError('No se pudo quitar el archivo de la tarjeta.')
        return
      }
      setMixedBlocks((current) => current.map((block) => block.id === blockId ? nextBlock : block))
      const removedAsset = await onRequestAttachmentRemove(attachmentId)
      if (removedAsset) {
        setAttachments((current) => current.filter((item) => item.id !== attachmentId))
      } else {
        setIntegrationError('El archivo se quitó de la tarjeta, pero su asset cifrado quedó pendiente de limpieza.')
      }
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo quitar el archivo de la tarjeta.')
    } finally {
      setFileBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  async function removeFileGroup(blockId: string, attachmentIds: readonly string[]) {
    if (!onRequestBlockSave || !onRequestAttachmentRemove || fileBusy || imageBusy) return
    setFileBusy(true)
    setIntegrationError('')
    clearIdleTimer()
    try {
      if (dirtyRef.current && !(await saveCurrentSnapshot())) {
        setIntegrationError('No se pudo guardar el contenido pendiente antes de eliminar la tarjeta.')
        return
      }
      const nextBlocks = mixedBlocks.filter((block) => block.id !== blockId)
      const removedFromDocument = await onRequestBlockSave({
        deletes: [blockId],
        order: nextBlocks.map((block) => block.id),
      })
      if (!removedFromDocument) {
        setIntegrationError('No se pudo eliminar la tarjeta de archivos.')
        return
      }
      setMixedBlocks(nextBlocks)

      const outcomes = await Promise.all(attachmentIds.map(async (attachmentId) => {
        try {
          return [attachmentId, await onRequestAttachmentRemove(attachmentId)] as const
        } catch {
          return [attachmentId, false] as const
        }
      }))
      const removedIds = new Set(outcomes.filter(([, removed]) => removed).map(([attachmentId]) => attachmentId))
      if (removedIds.size > 0) {
        setAttachments((current) => current.filter((item) => !removedIds.has(item.id)))
      }
      if (outcomes.some(([, removed]) => !removed)) {
        setIntegrationError('La tarjeta se eliminó, pero uno o más assets cifrados quedaron pendientes de limpieza.')
      }
      onActivity?.()
    } catch {
      setIntegrationError('No se pudo eliminar la tarjeta de archivos.')
    } finally {
      setFileBusy(false)
      if (dirtyRef.current) armAutosaveTimer()
    }
  }

  useEffect(() => {
    resizeBody()
  }, [])

  useEffect(() => {
    if (!mixedAvailable || !loadBlocks || !loadAttachments) {
      setMetadataReady(true)
      return
    }

    let active = true
    void Promise.all([loadBlocks(), loadAttachments()])
      .then(([blocks, loadedAttachments]) => {
        if (!active) return
        const currentPlain = bodyRef.current?.value ?? initialText
        const decision = decideOanixMixedDocumentLoad(currentPlain, blocks)
        setAttachments(loadedAttachments)

        if (decision.mode === 'mixed') {
          pendingMixedUpsertsRef.current.clear()
          committedSnapshotRef.current = {
            title: titleRef.current?.value ?? initialTitle,
            text: '',
          }
          setMixedBlocks(blocks)
          setDocumentMode('mixed')
          setIntegrationError('')
        } else if (decision.mode === 'recoverable-conflict') {
          setIntegrationError('La nota conserva texto y bloques simultáneamente. OANIX mantuvo el texto visible para no elegir una versión en silencio.')
        } else if (decision.mode === 'unsupported-blocks') {
          setIntegrationError(`La nota contiene elementos todavía no soportados: ${decision.unsupportedKinds.join(', ')}.`)
        } else {
          setIntegrationError('')
        }
      })
      .catch(() => {
        if (active) setIntegrationError('No se pudieron abrir las referencias de elementos de esta nota.')
      })
      .finally(() => {
        if (active) setMetadataReady(true)
      })

    return () => { active = false }
  }, [initialText, initialTitle, loadAttachments, loadBlocks, mixedAvailable])

  useEffect(() => {
    const viewport = window.visualViewport
    const editor = editorRef.current
    if (!viewport || !editor) return

    const syncVisualViewport = () => {
      editor.style.setProperty('--oanix-visible-height', `${viewport.height}px`)
      editor.style.setProperty('--oanix-viewport-top', `${viewport.offsetTop}px`)
    }

    syncVisualViewport()
    viewport.addEventListener('resize', syncVisualViewport)
    viewport.addEventListener('scroll', syncVisualViewport)
    return () => {
      viewport.removeEventListener('resize', syncVisualViewport)
      viewport.removeEventListener('scroll', syncVisualViewport)
    }
  }, [])

  useEffect(() => () => clearIdleTimer(), [])

  useEffect(() => {
    if (!dirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (mode !== 'auto' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent) => setTheme(event.matches ? 'dark' : 'default')
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [mode])

  const editingDisabled = saving || closing || imageBusy || fileBusy || codeBusy || checklistBusy || contactBusy || separatorBusy
  const showImageProgress = imageBusy && imageFeedback.visible
  const status = saving || saveInFlightRef.current || showImageProgress || fileBusy || codeBusy || checklistBusy || contactBusy || separatorBusy ? 'saving' : dirty ? 'unsaved' : 'saved'
  const statusLabel = separatorBusy
    ? 'Guardando separador…'
    : contactBusy
      ? 'Guardando contacto…'
    : checklistBusy
      ? 'Guardando checklist…'
    : codeBusy
      ? 'Guardando código…'
    : fileBusy
      ? fileProgressLabel(fileProgress)
      : showImageProgress
      ? imageProgressLabel(imageProgress, imageFeedback.stillRunning)
      : status === 'saving' ? 'Guardando…' : status === 'saved' ? 'Guardado' : 'Sin guardar'
  const visibleError = error || integrationError

  return (
    <section
      ref={editorRef}
      className="oanix-notes"
      data-theme={theme}
      data-note-id={noteId}
      data-document-mode={documentMode}
      data-unsaved={dirty ? 'true' : 'false'}
      aria-label="Editor de nota"
      aria-busy={editingDisabled}
    >
      <header className="oanix-notes__top-bar">
        <button className="oanix-notes__icon-btn" type="button" aria-label="Volver" data-oanix-back-close="true" data-oanix-save-and-close="true" disabled={editingDisabled} onClick={() => void requestClose()}>
          <Icon width={20} height={20}><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></Icon>
        </button>
        <div className="oanix-notes__save-status" data-status={status} role="status" aria-live="polite"><span className="oanix-notes__status-dot"/><span>{statusLabel}</span></div>
        <div className="oanix-notes__top-actions">
          <button className="oanix-notes__icon-btn oanix-notes__icon-btn--sm" type="button" aria-label="Deshacer" title="Deshacer" onPointerDown={(event) => event.preventDefault()} onClick={() => runNativeHistory('undo')}><Icon width={17} height={17}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></Icon></button>
          <button className="oanix-notes__icon-btn oanix-notes__icon-btn--sm" type="button" aria-label="Rehacer" title="Rehacer" onPointerDown={(event) => event.preventDefault()} onClick={() => runNativeHistory('redo')}><Icon width={17} height={17}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></Icon></button>
          <button className={`oanix-notes__icon-btn oanix-notes__icon-btn--sm${pinned ? ' is-active' : ''}`} type="button" aria-label="Fijar" title="Fijar nota" onClick={() => setPinned((value) => !value)}><Icon width={17} height={17}><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></Icon></button>
          <button className="oanix-notes__icon-btn oanix-notes__icon-btn--sm" type="button" aria-label="Personalizar" title="Personalizar hoja" onClick={openCustomize}><Icon width={17} height={17}><circle cx="13.5" cy="6.5" r="2.5"/><path d="M17 2l-5.5 5.5"/><path d="M22 9l-5.5 5.5"/><path d="M15 13l-8 8-4 1 1-4 8-8"/></Icon></button>
          <button className="oanix-notes__icon-btn oanix-notes__icon-btn--sm" type="button" aria-label="Más" onClick={openPanel}><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
        </div>
      </header>

      {visibleError && <div className="oanix-notes__error" role="alert">{visibleError}</div>}

      <main className="oanix-notes__editor-container">
        <div className="oanix-notes__sheet">
          <div className="oanix-notes__content">
            <div className="oanix-notes__header">
              <input ref={titleRef} className="oanix-notes__title" type="text" defaultValue={initialTitle} placeholder="Título" maxLength={160} autoComplete="off" autoCapitalize="sentences" spellCheck readOnly={editingDisabled} onInput={markActivity} onCompositionStart={() => { composingRef.current = true; onActivity?.() }} onCompositionEnd={() => { composingRef.current = false; markActivity() }}/>
            </div>
            <div className="oanix-notes__body-wrap">
              {documentMode === 'mixed' && loadAttachmentFile ? (
                <OanixMixedDocumentWithFiles
                  blocks={mixedBlocks}
                  attachments={attachments}
                  disabled={editingDisabled}
                  loadAttachmentFile={loadAttachmentFile}
                  onTextBlockChange={stageMixedBlock}
                  onTextCursorChange={rememberMixedCursor}
                  onPasteImage={(file, blockId, cursorOffset) => void insertMixedImageFiles([file], blockId, cursorOffset)}
                  onRemoveImage={removeMixedImage}
                  onAddFileGroupFiles={openFilePicker}
                  onRemoveFileGroupFile={removeFileFromGroup}
                  onRemoveFileGroup={removeFileGroup}
                  onRemoveCodeBlock={removeCodeBlock}
                  onRemoveChecklistBlock={removeChecklistBlock}
                  onRemoveContactBlock={removeContactBlock}
                  onRemoveSeparatorBlock={removeSeparatorBlock}
                  onActivity={markActivity}
                  onCompositionStart={() => { composingRef.current = true; onActivity?.() }}
                  onCompositionEnd={() => { composingRef.current = false; markActivity() }}
                  onError={setIntegrationError}
                />
              ) : (
                <textarea
                  ref={bodyRef}
                  className="oanix-notes__body"
                  defaultValue={initialText}
                  placeholder="Empieza a escribir…"
                  autoComplete="off"
                  autoCapitalize="sentences"
                  spellCheck
                  readOnly={editingDisabled}
                  onInput={handleBodyInput}
                  onSelect={rememberPlainCursor}
                  onKeyUp={rememberPlainCursor}
                  onPointerUp={rememberPlainCursor}
                  onPaste={handlePlainPaste}
                  onCompositionStart={() => { composingRef.current = true; onActivity?.() }}
                  onCompositionEnd={() => { composingRef.current = false; markActivity() }}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <button className={`oanix-notes__slide-handle${panelOpen ? ' is-hidden' : ''}`} type="button" aria-label="Abrir o mover menú del editor" title="Toca para abrir; arrastra para mover" data-side={handleSide} style={{ top: `${handleY * 100}%` }} onPointerDown={handleFloatingPointerDown} onPointerMove={handleFloatingPointerMove} onPointerUp={finishFloatingPointer} onPointerCancel={finishFloatingPointer}>
        <span className="oanix-notes__slide-indicator"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg></span>
      </button>

      <button className={`oanix-notes__panel-overlay${panelOpen ? ' is-active' : ''}`} type="button" aria-label="Cerrar menú" onClick={() => setPanelOpen(false)}/>
      <aside className={`oanix-notes__side-panel${panelOpen ? ' is-active' : ''}`} aria-hidden={!panelOpen}>
        <div className="oanix-notes__panel-header"><div><strong>Menú</strong><span>OANIX Editor</span></div><button className="oanix-notes__icon-btn oanix-notes__panel-close" type="button" aria-label="Cerrar" onClick={() => setPanelOpen(false)}><Icon><path d="M18 6L6 18"/><path d="M6 6l12 12"/></Icon></button></div>
        <div className="oanix-notes__panel-body">
          <section className="oanix-notes__panel-section"><span className="oanix-notes__section-label">Etiquetas</span><div className="oanix-notes__tags"><span>Sin etiquetas</span><button type="button" aria-label="Añadir etiqueta"><Icon width={16} height={16}><path d="M12 5v14"/><path d="M5 12h14"/></Icon></button></div></section>
          <div className="oanix-notes__divider"/>
          <ToolSection label="Añadir contenido" tools={[[ 'entry','Entrada' ],[ 'image','Imagen' ],[ 'file','Archivos' ],[ 'code','Código' ],[ 'checklist','Checklist' ],[ 'contact','Contacto' ],[ 'separator','Separador' ]]} onTool={(tool) => {
            if (tool === 'image') openImagePicker()
            if (tool === 'file') openFilePicker()
            if (tool === 'code') void insertCodeBlockFromMenu()
            if (tool === 'checklist') void insertChecklistBlockFromMenu()
            if (tool === 'contact') void insertContactBlockFromMenu()
            if (tool === 'separator') void insertSeparatorBlockFromMenu()
          }}/>
          <div className="oanix-notes__divider"/>
          <ToolSection label="Formato de texto" tools={[[ 'paragraph','Párrafo' ],[ 'h2','H2' ],[ 'h3','H3' ],[ 'quote','Cita' ],[ 'list','Lista' ],[ 'numbered-list','Numérica' ]]}/>
        </div>
        <div className="oanix-notes__panel-footer">OANIX v0.1</div>
      </aside>

      <button className={`oanix-notes__customize-overlay${customizeOpen ? ' is-active' : ''}`} type="button" aria-label="Cerrar personalización" onPointerDown={closeCustomizeFromPointer} onClick={closeCustomize}/>
      <section className={`oanix-notes__customize${customizeOpen ? ' is-active' : ''}`} aria-hidden={!customizeOpen}>
        <div className="oanix-notes__customize-handle"/>
        <div className="oanix-notes__customize-header"><div><strong>Personalizar</strong><span>Apariencia de la hoja</span></div><button className="oanix-notes__icon-btn" type="button" aria-label="Cerrar" onPointerDown={closeCustomizeFromPointer} onClick={closeCustomize}><Icon><path d="M18 6L6 18"/><path d="M6 6l12 12"/></Icon></button></div>
        <div className="oanix-notes__customize-body">
          <span className="oanix-notes__section-label">Modo</span>
          <div className="oanix-notes__mode-row">{(['light','dark','auto'] as const).map((value) => <button key={value} type="button" className={mode === value ? 'is-active' : ''} onClick={() => applyMode(value)}>{value === 'light' ? 'Día' : value === 'dark' ? 'Noche' : 'Auto'}</button>)}</div>
          <div className="oanix-notes__divider"/>
          <span className="oanix-notes__section-label">Tema de la hoja</span>
          <div className="oanix-notes__theme-grid">{[[ 'default','Claro' ],[ 'cream','Crema' ],[ 'sepia','Sepia' ],[ 'dark','Oscuro' ],[ 'midnight','Medianoche' ],[ 'forest','Bosque' ],[ 'rose','Rosa' ],[ 'lavender','Lavanda' ]].map(([value,label]) => <button key={value} type="button" className={theme === value ? 'is-active' : ''} onClick={() => setTheme(value)}><span className={`oanix-notes__theme-preview theme-${value}`}/><small>{label}</small></button>)}</div>
        </div>
      </section>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: 'none' }}
        onChange={(event) => {
          const selectedFiles = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          const mixedTarget = pendingMixedImageTargetRef.current
          const cursor = pendingImageCursorRef.current ?? lastPlainCursorRef.current
          pendingMixedImageTargetRef.current = null
          pendingImageCursorRef.current = null
          if (selectedFiles.length < 1) return
          if (selectedFiles.length > OANIX_IMAGE_BATCH_LIMIT) {
            setIntegrationError(`Puedes seleccionar hasta ${OANIX_IMAGE_BATCH_LIMIT} imágenes por vez.`)
            return
          }
          if (mixedTarget) void insertMixedImageFiles(selectedFiles, mixedTarget.blockId, mixedTarget.cursorOffset)
          else void insertImageFiles(selectedFiles, cursor)
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: 'none' }}
        onChange={(event) => {
          const selectedFiles = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          const groupBlockId = pendingFileGroupBlockIdRef.current
          const mixedTarget = pendingMixedFileTargetRef.current
          const cursor = pendingFileCursorRef.current ?? lastPlainCursorRef.current
          pendingFileGroupBlockIdRef.current = null
          pendingMixedFileTargetRef.current = null
          pendingFileCursorRef.current = null
          if (selectedFiles.length < 1) return
          if (selectedFiles.length > MAX_OANIX_FILE_GROUP_ITEMS) {
            setIntegrationError(`Puedes seleccionar hasta ${MAX_OANIX_FILE_GROUP_ITEMS} archivos por tarjeta.`)
            return
          }
          if (groupBlockId) void appendFilesToGroup(groupBlockId, selectedFiles)
          else if (mixedTarget) void insertMixedFileGroupFiles(selectedFiles, mixedTarget.blockId, mixedTarget.cursorOffset)
          else void insertFileGroupFiles(selectedFiles, cursor)
        }}
      />
    </section>
  )
}

function ToolSection({ label, tools, onTool }: { label: string; tools: Array<[string, string]>; onTool?: (tool: string) => void }) {
  return <section className="oanix-notes__panel-section"><span className="oanix-notes__section-label">{label}</span><div className="oanix-notes__tool-grid">{tools.map(([tool, label]) => <button key={tool} type="button" className="oanix-notes__tool" data-tool={tool} onClick={() => onTool?.(tool)}><span className={`oanix-notes__tool-icon tool-${tool}`}>{toolIcon(tool)}</span><span>{label}</span></button>)}</div></section>
}

function toolIcon(tool: string) {
  switch (tool) {
    case 'image': return <Icon width={24} height={24}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></Icon>
    case 'file': return <Icon width={24} height={24}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></Icon>
    case 'code': return <Icon width={24} height={24}><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></Icon>
    case 'checklist': return <Icon width={24} height={24}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Icon>
    case 'contact': return <Icon width={24} height={24}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>
    case 'separator': return <Icon width={24} height={24}><path d="M3 12h18"/></Icon>
    case 'paragraph': return <Icon width={24} height={24}><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></Icon>
    case 'h2': return <Icon width={24} height={24}><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v8"/></Icon>
    case 'h3': return <Icon width={24} height={24}><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></Icon>
    case 'quote': return <Icon width={24} height={24}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></Icon>
    case 'list': return <Icon width={24} height={24}><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></Icon>
    case 'numbered-list': return <Icon width={24} height={24}><path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></Icon>
    default: return <Icon width={24} height={24}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></Icon>
  }
}
