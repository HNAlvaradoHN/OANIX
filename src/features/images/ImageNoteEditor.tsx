import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { CodeBlockEditor } from '../editor/CodeBlockEditor'
import { keyboardInsetFromViewport } from '../../shared/viewportMetrics'
import { reconcileProtectedBlocks } from '../editor/protectedBlocks'
import {
  type ImageAlignment,
  type ImageBlock,
  type NoteBlock,
  type StoredNoteBlock,
} from '../notes/noteTypes'
import { loadEncryptedImage, loadEncryptedImagePreview, storeEncryptedImage } from './imageService'
import { defaultImageWidthPercent, imageAlignmentFromCenterRatio, isMobileImageViewport, resizeImageWidthPercent } from './imageLayout'
import './images.css'

interface ImageNoteEditorProps {
  noteId: string
  initialBlocks: StoredNoteBlock[]
  onChange: (blocks: StoredNoteBlock[]) => void
  onBlur: () => void
  onRemoveImage: (imageId: string) => Promise<void>
  onRestoreImage: (imageId: string) => void
}

interface PreviewState {
  url: string
  name: string
}

interface ResizeState {
  pointerId: number
  blockId: string
  figure: HTMLElement
  startX: number
  startY: number
  startWidthPercent: number
  editorWidth: number
  previewWidth: number
  previewHeight: number
  direction: string
}

interface ImageDragState {
  pointerId: number
  blockId: string
  figure: HTMLElement
  preview: HTMLElement
  startX: number
  startY: number
  startLeft: number
  figureWidth: number
  editorLeft: number
  editorWidth: number
  dragging: boolean
}

const DEFAULT_IMAGE_WIDTH = 100
const COMPACT_IMAGE_PERCENT = 55
const MAX_PREVIEW_ZOOM = 4
const MIN_PREVIEW_ZOOM = 1
const MAX_HISTORY_ENTRIES = 80
const HISTORY_GROUP_MS = 700

function cloneStoredBlocks(blocks: StoredNoteBlock[]): StoredNoteBlock[] {
  return structuredClone(blocks)
}

function storedBlocksEqual(left: StoredNoteBlock[], right: StoredNoteBlock[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function imageIdsFromBlocks(blocks: StoredNoteBlock[]): Set<string> {
  return new Set(
    blocks.filter((block): block is ImageBlock => block.type === 'image').map((block) => block.imageId),
  )
}

function createBlockId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function imageWidthPercent(block: ImageBlock): number {
  return block.widthPercent ?? DEFAULT_IMAGE_WIDTH
}

function imageAlignment(block: ImageBlock): ImageAlignment {
  return block.alignment ?? 'center'
}

function imageLocked(block: ImageBlock): boolean {
  return block.locked ?? false
}

function imageShowsName(block: ImageBlock): boolean {
  return block.showName ?? true
}

function toEditorBlocks(blocks: StoredNoteBlock[]): NoteBlock[] {
  return blocks.map((block) =>
    block.type === 'image'
      ? { id: block.id, type: 'paragraph', runs: [] }
      : block,
  )
}

function directBlockById(editor: HTMLElement, blockId: string): HTMLElement | null {
  return Array.from(editor.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.blockId === blockId,
  ) ?? null
}

function currentDirectBlockId(root: HTMLElement): string | null {
  const editor = root.querySelector<HTMLElement>('.editor-surface')
  const selection = document.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return null

  let element: Element | null =
    selection.anchorNode instanceof Element
      ? selection.anchorNode
      : selection.anchorNode?.parentElement ?? null

  while (element && element.parentElement !== editor) {
    element = element.parentElement
  }

  return element instanceof HTMLElement ? element.dataset.blockId ?? null : null
}

function mutableCodeIdsFromEditor(root: HTMLElement): Set<string> {
  const mutable = new Set<string>()
  const editor = root.querySelector<HTMLElement>('.editor-surface')
  if (!editor) return mutable

  const active = document.activeElement
  if (active instanceof Element && editor.contains(active) && active.matches('[data-code-language="true"]')) {
    const block = active.closest<HTMLElement>('[data-code-block="true"]')
    if (block?.dataset.blockId) mutable.add(block.dataset.blockId)
  }

  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return mutable

  const elementFor = (node: Node | null): Element | null =>
    node instanceof Element ? node : node?.parentElement ?? null
  const anchorContent = elementFor(selection.anchorNode)?.closest<HTMLElement>('[data-code-content="true"]') ?? null
  const focusContent = elementFor(selection.focusNode)?.closest<HTMLElement>('[data-code-content="true"]') ?? null

  if (anchorContent && anchorContent === focusContent && editor.contains(anchorContent)) {
    const block = anchorContent.closest<HTMLElement>('[data-code-block="true"]')
    if (block?.dataset.blockId) mutable.add(block.dataset.blockId)
  }

  return mutable
}

function formatImageSize(byteLength: number): string {
  if (byteLength < 1024 * 1024) return `${Math.max(1, Math.round(byteLength / 1024))} KB`
  return `${(byteLength / (1024 * 1024)).toFixed(1)} MB`
}

function clearImageSelection(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-image-block="true"]').forEach((figure) => {
    figure.dataset.imageSelected = 'false'
  })
}

function selectImageFigure(root: HTMLElement, figure: HTMLElement): void {
  clearImageSelection(root)
  if (figure.dataset.imageLocked !== 'true') {
    figure.dataset.imageSelected = 'true'
  }
}

function applyImageElementState(figure: HTMLElement, block: ImageBlock): void {
  const widthPercent = imageWidthPercent(block)
  const alignment = imageAlignment(block)
  const locked = imageLocked(block)
  const showName = imageShowsName(block)

  figure.style.width = `${widthPercent}%`
  figure.dataset.imageAlignment = alignment
  figure.dataset.imageLocked = String(locked)
  figure.dataset.imageCompact = String(widthPercent <= COMPACT_IMAGE_PERCENT)
  figure.dataset.imageShowName = String(showName)

  const preview = figure.querySelector<HTMLButtonElement>('[data-image-preview="true"]')
  if (preview) {
    preview.title = locked
      ? 'Abrir imagen'
      : 'Seleccionar imagen para ajustar tamaño o posición'
    preview.setAttribute(
      'aria-label',
      locked ? `Abrir imagen ${block.name}` : `Seleccionar imagen ${block.name}`,
    )
  }

  const lock = figure.querySelector<HTMLButtonElement>('[data-image-lock="true"]')
  if (lock) {
    lock.textContent = locked ? '🔒' : '🔓'
    lock.title = locked ? 'Desbloquear tamaño y posición' : 'Bloquear tamaño y posición'
    lock.setAttribute(
      'aria-label',
      locked ? 'Desbloquear tamaño y posición de la imagen' : 'Bloquear tamaño y posición de la imagen',
    )
    lock.setAttribute('aria-pressed', String(locked))
  }

  figure.querySelectorAll<HTMLButtonElement>('[data-image-resize]').forEach((handle) => {
    handle.disabled = locked
  })

  figure.querySelectorAll<HTMLButtonElement>('[data-image-align]').forEach((button) => {
    const active = button.dataset.imageAlign === alignment
    button.disabled = locked
    button.setAttribute('aria-pressed', String(active))
  })

  const name = figure.querySelector<HTMLElement>('[data-image-name="true"]')
  if (name) name.hidden = !showName

  const nameToggle = figure.querySelector<HTMLButtonElement>('[data-image-name-toggle="true"]')
  if (nameToggle) {
    nameToggle.textContent = showName ? 'Ocultar nombre' : 'Mostrar nombre'
    nameToggle.setAttribute('aria-pressed', String(!showName))
  }
}

function setImageInfoOpen(figure: HTMLElement, open: boolean): void {
  figure.dataset.imageInfoOpen = String(open)
  const button = figure.querySelector<HTMLButtonElement>('[data-image-info="true"]')
  if (button) {
    button.textContent = open ? '×' : '+'
    button.setAttribute('aria-expanded', String(open))
    button.title = open ? 'Cerrar opciones de imagen' : 'Mostrar información y descripción'
    button.setAttribute(
      'aria-label',
      open ? 'Cerrar opciones de imagen' : 'Mostrar información y descripción de la imagen',
    )
  }
}

function createResizeHandle(direction: string, label: string): HTMLButtonElement {
  const handle = document.createElement('button')
  handle.type = 'button'
  handle.className = `editor-image-block__resize editor-image-block__resize--${direction}`
  handle.dataset.imageResize = direction
  handle.setAttribute('aria-label', label)
  handle.title = label
  return handle
}

function createImageElement(block: ImageBlock, objectUrl?: string): HTMLElement {
  const figure = document.createElement('div')
  figure.className = 'editor-image-block'
  figure.dataset.imageBlock = 'true'
  figure.dataset.imageId = block.imageId
  figure.dataset.blockId = block.id
  figure.dataset.imageSelected = 'false'
  figure.dataset.imageInfoOpen = 'false'
  figure.contentEditable = 'false'

  const preview = document.createElement('button')
  preview.className = 'editor-image-block__preview'
  preview.type = 'button'
  preview.dataset.imagePreview = 'true'

  const image = document.createElement('img')
  image.alt = block.alt?.trim() || block.name
  image.loading = 'lazy'
  image.dataset.imageElement = 'true'
  if (objectUrl) image.src = objectUrl

  const loading = document.createElement('span')
  loading.className = 'editor-image-block__loading'
  loading.dataset.imageLoading = 'true'
  loading.textContent = objectUrl ? '' : 'Descifrando imagen…'

  preview.append(image, loading)

  const northWest = createResizeHandle('nw', 'Redimensionar imagen desde la esquina superior izquierda')
  const northEast = createResizeHandle('ne', 'Redimensionar imagen desde la esquina superior derecha')
  const southWest = createResizeHandle('sw', 'Redimensionar imagen desde la esquina inferior izquierda')
  const southEast = createResizeHandle('se', 'Redimensionar imagen desde la esquina inferior derecha')

  const footer = document.createElement('div')
  footer.className = 'editor-image-block__footer'

  const actions = document.createElement('div')
  actions.className = 'editor-image-block__actions'

  const lock = document.createElement('button')
  lock.type = 'button'
  lock.className = 'editor-image-block__lock'
  lock.dataset.imageLock = 'true'

  const info = document.createElement('button')
  info.type = 'button'
  info.className = 'editor-image-block__info'
  info.dataset.imageInfo = 'true'
  info.textContent = '+'
  info.title = 'Mostrar información y descripción'
  info.setAttribute('aria-label', 'Mostrar información y descripción de la imagen')
  info.setAttribute('aria-expanded', 'false')

  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'editor-image-block__open'
  open.dataset.imageOpenAction = 'true'
  open.textContent = 'Abrir'
  open.title = 'Abrir imagen en grande'

  const alignment = document.createElement('div')
  alignment.className = 'editor-image-block__alignment editor-image-block__secondary'
  alignment.setAttribute('role', 'group')
  alignment.setAttribute('aria-label', 'Posición horizontal de la imagen')

  const alignments: Array<{ value: ImageAlignment; label: string }> = [
    { value: 'left', label: 'Izq.' },
    { value: 'center', label: 'Centro' },
    { value: 'right', label: 'Der.' },
  ]

  for (const option of alignments) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.imageAlign = option.value
    button.textContent = option.label
    button.title = `Alinear imagen: ${option.label}`
    alignment.append(button)
  }

  const nameToggle = document.createElement('button')
  nameToggle.type = 'button'
  nameToggle.className = 'editor-image-block__name-toggle editor-image-block__secondary'
  nameToggle.dataset.imageNameToggle = 'true'

  const remove = document.createElement('button')
  remove.className = 'editor-image-block__remove editor-image-block__secondary'
  remove.type = 'button'
  remove.dataset.imageRemove = 'true'
  remove.textContent = 'Quitar imagen'

  actions.append(lock, info, open, alignment, nameToggle, remove)

  const details = document.createElement('div')
  details.className = 'editor-image-block__details'

  const meta = document.createElement('div')
  meta.className = 'editor-image-block__meta'
  const name = document.createElement('strong')
  name.dataset.imageName = 'true'
  name.textContent = block.name
  const size = document.createElement('span')
  size.textContent = formatImageSize(block.byteLength)
  meta.append(name, size)

  const alt = document.createElement('input')
  alt.className = 'editor-image-block__alt'
  alt.type = 'text'
  alt.value = block.alt ?? ''
  alt.placeholder = 'Descripción opcional'
  alt.maxLength = 240
  alt.dataset.imageAlt = 'true'
  alt.setAttribute('aria-label', 'Descripción de la imagen')

  details.append(meta, alt)
  footer.append(actions, details)
  figure.append(preview, northWest, northEast, southWest, southEast, footer)

  applyImageElementState(figure, block)
  return figure
}

function insertAfterBlock(editor: HTMLElement, block: HTMLElement, afterId: string | null): void {
  const reference = afterId ? directBlockById(editor, afterId) : null
  if (reference) {
    reference.after(block)
  } else {
    editor.append(block)
  }
}

function createEmptyEditorParagraph(): HTMLParagraphElement {
  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = createBlockId()
  paragraph.append(document.createElement('br'))
  return paragraph
}

function ensureTrailingParagraph(editor: HTMLElement): void {
  const last = editor.lastElementChild

  if (last instanceof HTMLParagraphElement && last.dataset.oanixTrailingCaret === 'true') {
    return
  }

  if (last instanceof HTMLParagraphElement && (last.textContent ?? '').trim() === '') {
    const previous = last.previousElementSibling
    if (previous instanceof HTMLElement && previous.dataset.imageBlock === 'true') {
      last.before(createEmptyEditorParagraph())
    }

    last.dataset.oanixTrailingCaret = 'true'
    return
  }

  if (last instanceof HTMLElement && last.dataset.imageBlock === 'true') {
    editor.append(createEmptyEditorParagraph())
  }

  const trailing = createEmptyEditorParagraph()
  trailing.dataset.oanixTrailingCaret = 'true'
  editor.append(trailing)
}

function usesMobileImageLayout(): boolean {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth
  return isMobileImageViewport(viewportWidth)
}

export function ImageNoteEditor({
  noteId,
  initialBlocks,
  onChange,
  onBlur,
  onRemoveImage,
  onRestoreImage,
}: ImageNoteEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef(
    new Map(
      initialBlocks
        .filter((block): block is ImageBlock => block.type === 'image')
        .map((block) => [block.id, block]),
    ),
  )
  const initialEditorBlocksRef = useRef(toEditorBlocks(initialBlocks))
  const objectUrlsRef = useRef(new Map<string, string>())
  const previewUrlsRef = useRef(new Map<string, string>())
  const insertionAfterIdRef = useRef<string | null>(null)
  const undoHistoryRef = useRef<StoredNoteBlock[][]>([])
  const redoHistoryRef = useRef<StoredNoteBlock[][]>([])
  const authorizedProtectedRemovalsRef = useRef(new Set<string>())
  const currentBlocksRef = useRef(cloneStoredBlocks(initialBlocks))
  const lastHistoryAtRef = useRef(0)
  const forceHistoryBoundaryRef = useRef(true)
  const [editorEpoch, setEditorEpoch] = useState(0)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [imageError, setImageError] = useState('')
  const [activeDockPanel, setActiveDockPanel] = useState<'format' | 'insert' | null>(null)

  function mergedBlocks(editorBlocks: NoteBlock[]): StoredNoteBlock[] {
    return editorBlocks.map((block) => imagesRef.current.get(block.id) ?? block)
  }

  function updateHistoryButtons(root: HTMLElement | null = rootRef.current) {
    root?.querySelectorAll<HTMLButtonElement>('[data-undo-tool="true"]').forEach((undo) => {
      undo.disabled = undoHistoryRef.current.length === 0
    })
    root?.querySelectorAll<HTMLButtonElement>('[data-redo-tool="true"]').forEach((redo) => {
      redo.disabled = redoHistoryRef.current.length === 0
    })
  }

  function rememberHistory(nextBlocks: StoredNoteBlock[]): boolean {
    const current = currentBlocksRef.current
    if (storedBlocksEqual(current, nextBlocks)) return false

    redoHistoryRef.current = []
    const now = Date.now()
    if (
      forceHistoryBoundaryRef.current ||
      undoHistoryRef.current.length === 0 ||
      now - lastHistoryAtRef.current > HISTORY_GROUP_MS
    ) {
      undoHistoryRef.current.push(cloneStoredBlocks(current))
      if (undoHistoryRef.current.length > MAX_HISTORY_ENTRIES) undoHistoryRef.current.shift()
    }

    currentBlocksRef.current = cloneStoredBlocks(nextBlocks)
    lastHistoryAtRef.current = now
    forceHistoryBoundaryRef.current = false
    updateHistoryButtons()
    return true
  }

  function restoreEditorModel(blocks: StoredNoteBlock[]) {
    imagesRef.current = new Map(
      blocks
        .filter((block): block is ImageBlock => block.type === 'image')
        .map((block) => [block.id, block]),
    )
    initialEditorBlocksRef.current = toEditorBlocks(blocks)
    setEditorEpoch((currentEpoch) => currentEpoch + 1)
  }

  function handleEditorChange(editorBlocks: NoteBlock[]) {
    const root = rootRef.current
    const editor = root?.querySelector<HTMLElement>('.editor-surface') ?? null
    const allowedRemovedIds = new Set(authorizedProtectedRemovalsRef.current)
    authorizedProtectedRemovalsRef.current.clear()

    const domAuthorizedRemoval = editor?.dataset.oanixAuthorizedProtectedRemoval
    if (domAuthorizedRemoval) {
      allowedRemovedIds.add(domAuthorizedRemoval)
      delete editor.dataset.oanixAuthorizedProtectedRemoval
    }

    const rawBlocks = mergedBlocks(editorBlocks)
    const reconciliation = reconcileProtectedBlocks(currentBlocksRef.current, rawBlocks, {
      allowedRemovedIds,
      mutableCodeIds: root ? mutableCodeIdsFromEditor(root) : new Set<string>(),
    })
    const nextBlocks = reconciliation.blocks
    const changed = rememberHistory(nextBlocks)

    if (reconciliation.repaired) restoreEditorModel(nextBlocks)
    if (!changed) return
    onChange(nextBlocks)
  }

  function emitEditorInput(root: HTMLElement) {
    const editor = root.querySelector<HTMLElement>('.editor-surface')
    if (!editor) return
    editor.dataset.empty = 'false'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function updateImageBlock(
    root: HTMLElement,
    blockId: string,
    update: (block: ImageBlock) => ImageBlock,
    save = true,
  ): ImageBlock | null {
    const current = imagesRef.current.get(blockId)
    if (!current) return null

    const next = update(current)
    imagesRef.current.set(blockId, next)

    const editor = root.querySelector<HTMLElement>('.editor-surface')
    const figure = editor ? directBlockById(editor, blockId) : null
    if (figure?.dataset.imageBlock === 'true') {
      applyImageElementState(figure, next)
    }

    if (save) emitEditorInput(root)
    return next
  }

  function revokeImageUrls(imageId: string) {
    const urls = new Set([
      objectUrlsRef.current.get(imageId),
      previewUrlsRef.current.get(imageId),
    ].filter((value): value is string => !!value))
    for (const url of urls) URL.revokeObjectURL(url)
    objectUrlsRef.current.delete(imageId)
    previewUrlsRef.current.delete(imageId)
  }

  async function ensureObjectUrl(block: ImageBlock): Promise<string | null> {
    const existing = objectUrlsRef.current.get(block.imageId)
    if (existing) return existing

    const blob = await loadEncryptedImage(block.imageId, block.mimeType)
    if (!blob) return null

    const url = URL.createObjectURL(blob)
    objectUrlsRef.current.set(block.imageId, url)
    return url
  }

  async function ensurePreviewObjectUrl(block: ImageBlock): Promise<string | null> {
    const existing = previewUrlsRef.current.get(block.imageId)
    if (existing) return existing

    const blob = await loadEncryptedImagePreview(block.imageId, block.mimeType)
    if (!blob) return null

    const url = URL.createObjectURL(blob)
    previewUrlsRef.current.set(block.imageId, url)
    return url
  }

  async function hydrateImageElement(root: HTMLElement, block: ImageBlock, figure: HTMLElement) {
    try {
      const url = await ensurePreviewObjectUrl(block)
      if (!url || !figure.isConnected || !root.contains(figure)) {
        const loading = figure.querySelector<HTMLElement>('[data-image-loading="true"]')
        if (loading) loading.textContent = 'Imagen no disponible'
        return
      }

      const image = figure.querySelector<HTMLImageElement>('[data-image-element="true"]')
      const loading = figure.querySelector<HTMLElement>('[data-image-loading="true"]')
      if (image) image.src = url
      if (loading) loading.textContent = ''
    } catch {
      const loading = figure.querySelector<HTMLElement>('[data-image-loading="true"]')
      if (loading) loading.textContent = 'No se pudo descifrar la imagen'
    }
  }

  function decorateToolbar(root: HTMLElement) {
    const toolbar = root.querySelector<HTMLElement>('.editor-toolbar')
    if (!toolbar) return

    if (!toolbar.querySelector('[data-image-tool="true"]')) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'editor-tool'
      button.dataset.imageTool = 'true'
      button.textContent = 'Imagen'
      button.title = 'Insertar imagen cifrada'
      button.setAttribute('aria-label', 'Insertar imagen')

      const codeTool = toolbar.querySelector('[data-format="code"]')
      toolbar.insertBefore(button, codeTool)
    }

    if (!toolbar.querySelector('[data-undo-tool="true"]')) {
      const undo = document.createElement('button')
      undo.type = 'button'
      undo.className = 'editor-tool'
      undo.dataset.undoTool = 'true'
      undo.textContent = '↶'
      undo.title = 'Deshacer último cambio (Ctrl/Cmd+Z)'
      undo.setAttribute('aria-label', 'Deshacer último cambio')
      toolbar.append(undo)
    }

    if (!toolbar.querySelector('[data-redo-tool="true"]')) {
      const redo = document.createElement('button')
      redo.type = 'button'
      redo.className = 'editor-tool'
      redo.dataset.redoTool = 'true'
      redo.textContent = '↷'
      redo.title = 'Rehacer último cambio (Ctrl/Cmd+Shift+Z o Ctrl+Y)'
      redo.setAttribute('aria-label', 'Rehacer último cambio')
      toolbar.append(redo)
    }

    updateHistoryButtons(root)
  }

  function hydrateStoredImages(root: HTMLElement) {
    const editor = root.querySelector<HTMLElement>('.editor-surface')
    if (!editor) return

    for (const block of imagesRef.current.values()) {
      let element = directBlockById(editor, block.id)
      if (!element) continue

      if (element.dataset.imageBlock !== 'true') {
        const imageElement = createImageElement(block, objectUrlsRef.current.get(block.imageId))
        element.replaceWith(imageElement)
        element = imageElement
      } else {
        applyImageElementState(element, block)
      }

      if (!previewUrlsRef.current.has(block.imageId)) {
        void hydrateImageElement(root, block, element)
      }

      ensureTrailingParagraph(editor)
    }

    if (imagesRef.current.size > 0) editor.dataset.empty = 'false'
  }

  async function insertFiles(files: File[]) {
    const root = rootRef.current
    const editor = root?.querySelector<HTMLElement>('.editor-surface')
    if (!root || !editor || files.length === 0) return

    setImageError('')
    forceHistoryBoundaryRef.current = true
    let afterId = insertionAfterIdRef.current
    let lastElement: HTMLElement | null = null

    for (const file of files) {
      try {
        const stored = await storeEncryptedImage(file)
        const block: ImageBlock = {
          id: createBlockId(),
          type: 'image',
          ...stored,
          widthPercent: defaultImageWidthPercent(usesMobileImageLayout()),
          alignment: 'center',
          locked: false,
          showName: true,
        }

        const url = URL.createObjectURL(file)
        objectUrlsRef.current.set(block.imageId, url)
        imagesRef.current.set(block.id, block)

        const element = createImageElement(block, url)
        insertAfterBlock(editor, element, afterId)
        void hydrateImageElement(root, block, element)
        ensureTrailingParagraph(editor)
        afterId = block.id
        lastElement = element
      } catch (error) {
        setImageError(error instanceof Error ? error.message : 'No se pudo guardar la imagen cifrada.')
      }
    }

    insertionAfterIdRef.current = afterId
    if (lastElement) selectImageFigure(root, lastElement)
    emitEditorInput(root)
  }

  function applyHistoryState(
    root: HTMLElement,
    source: { current: StoredNoteBlock[][] },
    destination: { current: StoredNoteBlock[][] },
  ) {
    const target = source.current.pop()
    if (!target) {
      updateHistoryButtons(root)
      return
    }

    const current = cloneStoredBlocks(currentBlocksRef.current)
    destination.current.push(current)
    if (destination.current.length > MAX_HISTORY_ENTRIES) destination.current.shift()

    const currentImageIds = imageIdsFromBlocks(current)
    const targetImageIds = imageIdsFromBlocks(target)
    for (const imageId of currentImageIds) {
      if (!targetImageIds.has(imageId)) {
        revokeImageUrls(imageId)
        void onRemoveImage(imageId)
      }
    }
    for (const imageId of targetImageIds) {
      if (!currentImageIds.has(imageId)) onRestoreImage(imageId)
    }

    currentBlocksRef.current = cloneStoredBlocks(target)
    lastHistoryAtRef.current = 0
    forceHistoryBoundaryRef.current = true
    onChange(cloneStoredBlocks(target))
    restoreEditorModel(target)
    updateHistoryButtons(root)
  }

  function undoLastChange(root: HTMLElement) {
    applyHistoryState(root, undoHistoryRef, redoHistoryRef)
  }

  function redoLastChange(root: HTMLElement) {
    applyHistoryState(root, redoHistoryRef, undoHistoryRef)
  }

  async function openImage(block: ImageBlock) {
    try {
      const url = await ensureObjectUrl(block)
      if (!url) {
        setImageError('La imagen cifrada no está disponible en este dispositivo.')
        return
      }

      setPreviewZoom(1)
      setPreview({
        url,
        name: block.alt?.trim() || (imageShowsName(block) ? block.name : 'Imagen'),
      })
    } catch {
      setImageError('No se pudo abrir la imagen cifrada.')
    }
  }

  useEffect(() => {
    const currentRoot = rootRef.current
    if (!currentRoot) return
    const root: HTMLDivElement = currentRoot
    let resizeState: ResizeState | null = null
    let imageDragState: ImageDragState | null = null
    let gestureListenersAttached = false

    function syncVisualViewportMetrics() {
      const visualViewport = window.visualViewport
      const visualHeight = visualViewport?.height ?? window.innerHeight
      const inset = keyboardInsetFromViewport({
        layoutHeight: window.innerHeight,
        visualHeight,
        visualOffsetTop: visualViewport?.offsetTop ?? 0,
      })

      root.style.setProperty('--oanix-keyboard-inset', `${inset}px`)
      root.style.setProperty('--oanix-visual-height', `${Math.max(1, Math.round(visualHeight))}px`)
    }

    syncVisualViewportMetrics()
    window.visualViewport?.addEventListener('resize', syncVisualViewportMetrics)
    window.visualViewport?.addEventListener('scroll', syncVisualViewportMetrics)
    window.addEventListener('resize', syncVisualViewportMetrics)

    decorateToolbar(root)
    hydrateStoredImages(root)

    const observerOptions: MutationObserverInit = { childList: true, subtree: true }
    const observer = new MutationObserver(() => {
      // Hydration mutates image controls (labels, loading state, etc.).
      // Disconnect while applying those internal changes so the observer
      // cannot recursively react to mutations caused by its own callback.
      observer.disconnect()
      decorateToolbar(root)
      hydrateStoredImages(root)
      observer.observe(root, observerOptions)
    })
    observer.observe(root, observerOptions)

    function handleMouseDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const toolbarButton = target.closest<HTMLButtonElement>('.editor-toolbar button')
      if (toolbarButton && root.contains(toolbarButton)) {
        forceHistoryBoundaryRef.current = true
      }

      if (!target.closest('[data-image-tool="true"]')) return
      insertionAfterIdRef.current = currentDirectBlockId(root)
      event.preventDefault()
    }

    function attachGestureListeners() {
      if (gestureListenersAttached) return
      gestureListenersAttached = true
      document.addEventListener('pointermove', handlePointerMove, true)
      document.addEventListener('pointerup', handlePointerUp, true)
      document.addEventListener('pointercancel', handlePointerUp, true)
    }

    function detachGestureListeners() {
      if (!gestureListenersAttached) return
      gestureListenersAttached = false
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('pointercancel', handlePointerUp, true)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const handle = target.closest<HTMLButtonElement>('[data-image-resize]')
      if (!handle || !root.contains(handle)) {
        const preview = target.closest<HTMLElement>('[data-image-preview="true"]')
        const figure = preview?.closest<HTMLElement>('[data-image-block="true"]')
        const blockId = figure?.dataset.blockId
        const block = blockId ? imagesRef.current.get(blockId) : null
        const editor = root.querySelector<HTMLElement>('.editor-surface')

        if (preview && figure && blockId && block && editor && !imageLocked(block) && event.isPrimary) {
          const figureRect = figure.getBoundingClientRect()
          const editorRect = editor.getBoundingClientRect()
          imageDragState = {
            pointerId: event.pointerId,
            blockId,
            figure,
            preview,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: figureRect.left,
            figureWidth: figureRect.width,
            editorLeft: editorRect.left,
            editorWidth: editorRect.width,
            dragging: false,
          }
          attachGestureListeners()
        }
        return
      }

      const figure = handle.closest<HTMLElement>('[data-image-block="true"]')
      const blockId = figure?.dataset.blockId
      const block = blockId ? imagesRef.current.get(blockId) : null
      const editor = root.querySelector<HTMLElement>('.editor-surface')
      if (!figure || !blockId || !block || !editor || imageLocked(block)) return

      event.preventDefault()
      event.stopPropagation()
      forceHistoryBoundaryRef.current = true
      selectImageFigure(root, figure)

      const previewRect = figure
        .querySelector<HTMLElement>('[data-image-preview="true"]')
        ?.getBoundingClientRect()

      resizeState = {
        pointerId: event.pointerId,
        blockId,
        figure,
        startX: event.clientX,
        startY: event.clientY,
        startWidthPercent: imageWidthPercent(block),
        editorWidth: editor.getBoundingClientRect().width,
        previewWidth: previewRect?.width ?? figure.getBoundingClientRect().width,
        previewHeight: previewRect?.height ?? figure.getBoundingClientRect().height,
        direction: handle.dataset.imageResize ?? 'se',
      }
      attachGestureListeners()
    }

    function handlePointerMove(event: PointerEvent) {
      if (imageDragState && imageDragState.pointerId === event.pointerId) {
        const deltaX = event.clientX - imageDragState.startX
        const deltaY = event.clientY - imageDragState.startY

        if (!imageDragState.dragging) {
          if (Math.abs(deltaX) < 7 || Math.abs(deltaX) <= Math.abs(deltaY)) return
          imageDragState.dragging = true
          imageDragState.preview.setPointerCapture?.(event.pointerId)
          imageDragState.figure.dataset.imageDragging = 'true'
          forceHistoryBoundaryRef.current = true
        }

        event.preventDefault()
        const minLeft = imageDragState.editorLeft
        const maxLeft = imageDragState.editorLeft + imageDragState.editorWidth - imageDragState.figureWidth
        const desiredLeft = imageDragState.startLeft + deltaX
        const clampedLeft = Math.min(maxLeft, Math.max(minLeft, desiredLeft))
        imageDragState.figure.style.translate = `${Math.round(clampedLeft - imageDragState.startLeft)}px 0`
        return
      }

      if (!resizeState || resizeState.pointerId !== event.pointerId) return

      const nextWidth = resizeImageWidthPercent({
        editorWidth: resizeState.editorWidth,
        startWidthPercent: resizeState.startWidthPercent,
        previewWidth: resizeState.previewWidth,
        previewHeight: resizeState.previewHeight,
        deltaX: event.clientX - resizeState.startX,
        deltaY: event.clientY - resizeState.startY,
        direction: resizeState.direction,
        mobile: usesMobileImageLayout(),
      })

      updateImageBlock(
        root,
        resizeState.blockId,
        (block) => ({ ...block, widthPercent: nextWidth }),
        false,
      )
      resizeState.figure.dataset.imageSelected = 'true'
    }

    function handlePointerUp(event: PointerEvent) {
      if (imageDragState && imageDragState.pointerId === event.pointerId) {
        const drag = imageDragState
        imageDragState = null

        if (drag.dragging) {
          const deltaX = event.clientX - drag.startX
          const minLeft = drag.editorLeft
          const maxLeft = drag.editorLeft + drag.editorWidth - drag.figureWidth
          const desiredLeft = Math.min(maxLeft, Math.max(minLeft, drag.startLeft + deltaX))
          const centerRatio = drag.editorWidth > 0
            ? ((desiredLeft - drag.editorLeft) + drag.figureWidth / 2) / drag.editorWidth
            : 0.5
          const alignment = imageAlignmentFromCenterRatio(centerRatio)

          drag.figure.style.translate = ''
          delete drag.figure.dataset.imageDragging
          drag.figure.dataset.imageJustDragged = 'true'
          window.setTimeout(() => delete drag.figure.dataset.imageJustDragged, 0)
          updateImageBlock(root, drag.blockId, (current) => ({ ...current, alignment }))
          selectImageFigure(root, drag.figure)
        }
        detachGestureListeners()
        return
      }

      if (!resizeState || resizeState.pointerId !== event.pointerId) return
      resizeState = null
      emitEditorInput(root)
      detachGestureListeners()
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      if (!target.closest('.editor-command-panel') && !target.closest('.mobile-editor-dock')) {
        setActiveDockPanel(null)
      }

      const undoTool = target.closest<HTMLElement>('[data-undo-tool="true"]')
      if (undoTool && root.contains(undoTool)) {
        event.preventDefault()
        event.stopPropagation()
        undoLastChange(root)
        return
      }

      const redoTool = target.closest<HTMLElement>('[data-redo-tool="true"]')
      if (redoTool && root.contains(redoTool)) {
        event.preventDefault()
        event.stopPropagation()
        redoLastChange(root)
        return
      }

      const imageTool = target.closest<HTMLElement>('[data-image-tool="true"]')
      if (imageTool && root.contains(imageTool)) {
        event.preventDefault()
        event.stopPropagation()
        inputRef.current?.click()
        return
      }

      const figure = target.closest<HTMLElement>('[data-image-block="true"]')

      const lockButton = target.closest<HTMLButtonElement>('[data-image-lock="true"]')
      if (lockButton && figure && root.contains(lockButton)) {
        const blockId = figure.dataset.blockId
        const block = blockId ? imagesRef.current.get(blockId) : null
        if (!blockId || !block) return

        event.preventDefault()
        event.stopPropagation()
        const next = updateImageBlock(root, blockId, (current) => ({
          ...current,
          locked: !imageLocked(current),
        }))

        if (next && imageLocked(next)) {
          figure.dataset.imageSelected = 'false'
        } else {
          selectImageFigure(root, figure)
        }
        return
      }

      const infoButton = target.closest<HTMLButtonElement>('[data-image-info="true"]')
      if (infoButton && figure && root.contains(infoButton)) {
        event.preventDefault()
        event.stopPropagation()
        setImageInfoOpen(figure, figure.dataset.imageInfoOpen !== 'true')
        return
      }

      const alignmentButton = target.closest<HTMLButtonElement>('[data-image-align]')
      if (alignmentButton && figure && root.contains(alignmentButton)) {
        const blockId = figure.dataset.blockId
        const block = blockId ? imagesRef.current.get(blockId) : null
        const alignment = alignmentButton.dataset.imageAlign as ImageAlignment | undefined
        if (!blockId || !block || !alignment || imageLocked(block)) return

        event.preventDefault()
        event.stopPropagation()
        updateImageBlock(root, blockId, (current) => ({ ...current, alignment }))
        selectImageFigure(root, figure)
        return
      }

      const nameToggle = target.closest<HTMLButtonElement>('[data-image-name-toggle="true"]')
      if (nameToggle && figure && root.contains(nameToggle)) {
        const blockId = figure.dataset.blockId
        if (!blockId) return

        event.preventDefault()
        event.stopPropagation()
        updateImageBlock(root, blockId, (current) => ({
          ...current,
          showName: !imageShowsName(current),
        }))
        return
      }

      const remove = target.closest<HTMLElement>('[data-image-remove="true"]')
      if (remove && figure && root.contains(remove)) {
        const blockId = figure.dataset.blockId
        if (!blockId) return

        event.preventDefault()
        event.stopPropagation()

        const imageBlock = imagesRef.current.get(blockId)
        forceHistoryBoundaryRef.current = true
        authorizedProtectedRemovalsRef.current.add(blockId)
        if (imageBlock) revokeImageUrls(imageBlock.imageId)

        imagesRef.current.delete(blockId)
        figure.remove()
        emitEditorInput(root)
        if (imageBlock) void onRemoveImage(imageBlock.imageId)
        return
      }

      const openAction = target.closest<HTMLElement>('[data-image-open-action="true"]')
      if (openAction && figure && root.contains(openAction)) {
        const blockId = figure.dataset.blockId
        const block = blockId ? imagesRef.current.get(blockId) : null
        if (!block) return

        event.preventDefault()
        event.stopPropagation()
        void openImage(block)
        return
      }

      const previewButton = target.closest<HTMLElement>('[data-image-preview="true"]')
      if (previewButton && figure && root.contains(previewButton)) {
        if (figure.dataset.imageJustDragged === 'true') {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        const blockId = figure.dataset.blockId
        const block = blockId ? imagesRef.current.get(blockId) : null
        if (!block) return

        event.preventDefault()
        event.stopPropagation()
        if (imageLocked(block)) {
          void openImage(block)
        } else {
          selectImageFigure(root, figure)
        }
        return
      }

      if (figure && root.contains(figure)) {
        const blockId = figure.dataset.blockId
        const block = blockId ? imagesRef.current.get(blockId) : null
        if (block && !imageLocked(block)) selectImageFigure(root, figure)
        return
      }

      clearImageSelection(root)
    }

    function handleImageInput(event: Event) {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.dataset.imageAlt !== 'true') return

      const figure = target.closest<HTMLElement>('[data-image-block="true"]')
      const blockId = figure?.dataset.blockId
      const block = blockId ? imagesRef.current.get(blockId) : null
      if (!blockId || !block) return

      updateImageBlock(root, blockId, (current) => ({ ...current, alt: target.value }), false)
      const image = figure?.querySelector<HTMLImageElement>('[data-image-element="true"]')
      if (image) image.alt = target.value.trim() || block.name
      emitEditorInput(root)
    }

    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
      if (files.length === 0) return

      insertionAfterIdRef.current = currentDirectBlockId(root)
      event.preventDefault()
      event.stopPropagation()
      void insertFiles(files)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey) {
        const target = event.target
        const key = event.key.toLowerCase()
        if (target instanceof Node && root.contains(target)) {
          if (key === 'z') {
            event.preventDefault()
            if (event.shiftKey) redoLastChange(root)
            else undoLastChange(root)
            return
          }

          if (!event.shiftKey && key === 'y') {
            event.preventDefault()
            redoLastChange(root)
            return
          }
        }
      }

      if (event.key === 'Escape') {
        setPreview(null)
        setPreviewZoom(1)
        setActiveDockPanel(null)
      }
    }

    root.addEventListener('mousedown', handleMouseDown, true)
    root.addEventListener('pointerdown', handlePointerDown, true)
    root.addEventListener('click', handleClick, true)
    root.addEventListener('input', handleImageInput, true)
    root.addEventListener('paste', handlePaste, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      observer.disconnect()
      detachGestureListeners()
      root.removeEventListener('mousedown', handleMouseDown, true)
      root.removeEventListener('pointerdown', handlePointerDown, true)
      root.removeEventListener('click', handleClick, true)
      root.removeEventListener('input', handleImageInput, true)
      root.removeEventListener('paste', handlePaste, true)
      document.removeEventListener('keydown', handleKeyDown)
      window.visualViewport?.removeEventListener('resize', syncVisualViewportMetrics)
      window.visualViewport?.removeEventListener('scroll', syncVisualViewportMetrics)
      window.removeEventListener('resize', syncVisualViewportMetrics)

      const urls = new Set([...objectUrlsRef.current.values(), ...previewUrlsRef.current.values()])
      for (const url of urls) URL.revokeObjectURL(url)
      objectUrlsRef.current.clear()
      previewUrlsRef.current.clear()
    }
  }, [noteId])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    await insertFiles(files)
  }

  function keepEditorSelection(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  function triggerToolbarAction(selector: string) {
    const root = rootRef.current
    const button = root?.querySelector<HTMLButtonElement>(`.editor-toolbar ${selector}`)
    if (!button) return
    button.click()
    setActiveDockPanel(null)
  }

  function triggerImageInsert() {
    const root = rootRef.current
    if (!root) return
    insertionAfterIdRef.current = currentDirectBlockId(root)
    setActiveDockPanel(null)
    inputRef.current?.click()
  }

  function closePreview() {
    setPreview(null)
    setPreviewZoom(1)
  }

  function changePreviewZoom(delta: number) {
    setPreviewZoom((current) =>
      Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, Number((current + delta).toFixed(2)))),
    )
  }

  return (
    <div
      ref={rootRef}
      className={`image-note-editor-root${activeDockPanel ? ' image-note-editor-root--panel-open' : ''}`}
    >
      <CodeBlockEditor
        key={`${noteId}:${editorEpoch}`}
        noteId={noteId}
        initialBlocks={initialEditorBlocksRef.current}
        onChange={handleEditorChange}
        onBlur={onBlur}
      />

      {activeDockPanel === 'format' && (
        <div className="editor-command-panel editor-command-panel--format" role="dialog" aria-label="Formato de texto">
          <div className="editor-command-panel__heading"><strong>Formato</strong><span>Texto y estructura</span></div>
          <div className="editor-command-grid">
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="bold"]')}><strong>B</strong><span>Negrita</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="italic"]')}><em>I</em><span>Cursiva</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="paragraph"]')}><strong>P</strong><span>Párrafo</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="heading2"]')}><strong>H2</strong><span>Título</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="heading3"]')}><strong>H3</strong><span>Subtítulo</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="bulletList"]')}><strong>•</strong><span>Lista</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="orderedList"]')}><strong>1.</strong><span>Numerada</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="quote"]')}><strong>❝</strong><span>Cita</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="link"]')}><strong>↗</strong><span>Enlace</span></button>
          </div>
        </div>
      )}

      {activeDockPanel === 'insert' && (
        <div className="editor-command-panel editor-command-panel--insert" role="dialog" aria-label="Insertar contenido">
          <div className="editor-command-panel__heading"><strong>Insertar</strong><span>Contenido de la nota</span></div>
          <div className="editor-command-grid editor-command-grid--insert">
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-insert="dailyEntry"]')}><strong>◷</strong><span>Nueva entrada</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={triggerImageInsert}><strong>▧</strong><span>Imagen</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-format="code"]')}><strong>&lt;/&gt;</strong><span>Código</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-insert="checklist"]')}><strong>☑</strong><span>Checklist</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[data-insert="contact"]')}><strong>◉</strong><span>Contacto</span></button>
            <button type="button" onPointerDown={keepEditorSelection} onClick={() => triggerToolbarAction('[title="Separador"]')}><strong>—</strong><span>Separador</span></button>
          </div>
        </div>
      )}

      <div className="mobile-editor-dock" role="toolbar" aria-label="Acciones rápidas del editor">
        <button
          className="mobile-editor-dock__history"
          type="button"
          data-undo-tool="true"
          aria-label="Deshacer último cambio"
          title="Deshacer"
        >↶</button>
        <button
          className="mobile-editor-dock__history"
          type="button"
          data-redo-tool="true"
          aria-label="Rehacer último cambio"
          title="Rehacer"
        >↷</button>
        <button
          className="mobile-editor-dock__format"
          type="button"
          aria-label="Formato de texto"
          aria-expanded={activeDockPanel === 'format'}
          title="Formato"
          onPointerDown={keepEditorSelection}
          onClick={() => setActiveDockPanel((panel) => panel === 'format' ? null : 'format')}
        >Aa</button>
        <button
          className="mobile-editor-dock__insert"
          type="button"
          aria-label="Insertar contenido"
          aria-expanded={activeDockPanel === 'insert'}
          title="Insertar"
          onPointerDown={keepEditorSelection}
          onClick={() => setActiveDockPanel((panel) => panel === 'insert' ? null : 'insert')}
        >＋</button>
      </div>

      <input
        ref={inputRef}
        className="image-note-editor__input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={(event) => void handleFileChange(event)}
        tabIndex={-1}
        aria-hidden="true"
      />

      {imageError && <p className="image-note-editor__error" role="alert">{imageError}</p>}

      {preview && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={preview.name} onClick={closePreview}>
          <div className="image-lightbox__content" onClick={(event) => event.stopPropagation()}>
            <div className="image-lightbox__toolbar">
              <button
                type="button"
                onClick={() => changePreviewZoom(-0.25)}
                disabled={previewZoom <= MIN_PREVIEW_ZOOM}
                aria-label="Alejar imagen"
              >
                −
              </button>
              <button
                className="image-lightbox__zoom-label"
                type="button"
                onClick={() => setPreviewZoom(1)}
                title="Restablecer zoom"
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => changePreviewZoom(0.25)}
                disabled={previewZoom >= MAX_PREVIEW_ZOOM}
                aria-label="Acercar imagen"
              >
                +
              </button>
              <button className="image-lightbox__close" type="button" onClick={closePreview} aria-label="Cerrar imagen">×</button>
            </div>
            <div className="image-lightbox__viewport">
              <img
                src={preview.url}
                alt={preview.name}
                style={{ transform: `scale(${previewZoom})` }}
                onDoubleClick={() => setPreviewZoom((current) => current > 1 ? 1 : 2)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
