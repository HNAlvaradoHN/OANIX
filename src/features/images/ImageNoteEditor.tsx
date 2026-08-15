import { useEffect, useRef, useState } from 'react'
import { CodeBlockEditor } from '../editor/CodeBlockEditor'
import {
  type ImageBlock,
  type NoteBlock,
  type StoredNoteBlock,
} from '../notes/noteTypes'
import { loadEncryptedImage, storeEncryptedImage } from './imageService'
import './images.css'

interface ImageNoteEditorProps {
  noteId: string
  initialBlocks: StoredNoteBlock[]
  onChange: (blocks: StoredNoteBlock[]) => void
  onBlur: () => void
}

interface PreviewState {
  url: string
  name: string
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

function formatImageSize(byteLength: number): string {
  if (byteLength < 1024 * 1024) return `${Math.max(1, Math.round(byteLength / 1024))} KB`
  return `${(byteLength / (1024 * 1024)).toFixed(1)} MB`
}

function createImageElement(block: ImageBlock, objectUrl?: string): HTMLElement {
  const figure = document.createElement('div')
  figure.className = 'editor-image-block'
  figure.dataset.imageBlock = 'true'
  figure.dataset.imageId = block.imageId
  figure.dataset.blockId = block.id
  figure.contentEditable = 'false'

  const preview = document.createElement('button')
  preview.className = 'editor-image-block__preview'
  preview.type = 'button'
  preview.dataset.imageOpen = 'true'
  preview.setAttribute('aria-label', `Abrir imagen ${block.name}`)

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

  const footer = document.createElement('div')
  footer.className = 'editor-image-block__footer'

  const meta = document.createElement('div')
  meta.className = 'editor-image-block__meta'
  const name = document.createElement('strong')
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

  const remove = document.createElement('button')
  remove.className = 'editor-image-block__remove'
  remove.type = 'button'
  remove.dataset.imageRemove = 'true'
  remove.textContent = 'Quitar imagen'

  footer.append(meta, alt, remove)
  figure.append(preview, footer)
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

function ensureTrailingParagraph(editor: HTMLElement, after: HTMLElement): void {
  const next = after.nextElementSibling
  if (next) return

  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = createBlockId()
  paragraph.append(document.createElement('br'))
  editor.append(paragraph)
}

export function ImageNoteEditor({
  noteId,
  initialBlocks,
  onChange,
  onBlur,
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
  const insertionAfterIdRef = useRef<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [imageError, setImageError] = useState('')

  function mergedBlocks(editorBlocks: NoteBlock[]): StoredNoteBlock[] {
    return editorBlocks.map((block) => imagesRef.current.get(block.id) ?? block)
  }

  function handleEditorChange(editorBlocks: NoteBlock[]) {
    onChange(mergedBlocks(editorBlocks))
  }

  function emitEditorInput(root: HTMLElement) {
    const editor = root.querySelector<HTMLElement>('.editor-surface')
    if (!editor) return
    editor.dataset.empty = 'false'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
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

  async function hydrateImageElement(root: HTMLElement, block: ImageBlock, figure: HTMLElement) {
    try {
      const url = await ensureObjectUrl(block)
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
    if (!toolbar || toolbar.querySelector('[data-image-tool="true"]')) return

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
      }

      if (!objectUrlsRef.current.has(block.imageId)) {
        void hydrateImageElement(root, block, element)
      }
    }

    if (imagesRef.current.size > 0) editor.dataset.empty = 'false'
  }

  async function insertFiles(files: File[]) {
    const root = rootRef.current
    const editor = root?.querySelector<HTMLElement>('.editor-surface')
    if (!root || !editor || files.length === 0) return

    setImageError('')
    let afterId = insertionAfterIdRef.current

    for (const file of files) {
      try {
        const stored = await storeEncryptedImage(file)
        const block: ImageBlock = {
          id: createBlockId(),
          type: 'image',
          ...stored,
        }

        const url = URL.createObjectURL(file)
        objectUrlsRef.current.set(block.imageId, url)
        imagesRef.current.set(block.id, block)

        const element = createImageElement(block, url)
        insertAfterBlock(editor, element, afterId)
        ensureTrailingParagraph(editor, element)
        afterId = block.id
      } catch (error) {
        setImageError(error instanceof Error ? error.message : 'No se pudo guardar la imagen cifrada.')
      }
    }

    insertionAfterIdRef.current = afterId
    emitEditorInput(root)
  }

  async function openImage(block: ImageBlock) {
    try {
      const url = await ensureObjectUrl(block)
      if (!url) {
        setImageError('La imagen cifrada no está disponible en este dispositivo.')
        return
      }
      setPreview({ url, name: block.alt?.trim() || block.name })
    } catch {
      setImageError('No se pudo abrir la imagen cifrada.')
    }
  }

  useEffect(() => {
    const currentRoot = rootRef.current
    if (!currentRoot) return
    const root: HTMLDivElement = currentRoot

    decorateToolbar(root)
    hydrateStoredImages(root)

    const observer = new MutationObserver(() => {
      decorateToolbar(root)
      hydrateStoredImages(root)
    })
    observer.observe(root, { childList: true, subtree: true })

    function handleMouseDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('[data-image-tool="true"]')) return

      insertionAfterIdRef.current = currentDirectBlockId(root)
      event.preventDefault()
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const imageTool = target.closest<HTMLElement>('[data-image-tool="true"]')
      if (imageTool && root.contains(imageTool)) {
        event.preventDefault()
        event.stopPropagation()
        inputRef.current?.click()
        return
      }

      const remove = target.closest<HTMLElement>('[data-image-remove="true"]')
      if (remove && root.contains(remove)) {
        const figure = remove.closest<HTMLElement>('[data-image-block="true"]')
        const blockId = figure?.dataset.blockId
        if (!figure || !blockId) return

        event.preventDefault()
        event.stopPropagation()

        const imageBlock = imagesRef.current.get(blockId)
        if (imageBlock) {
          const url = objectUrlsRef.current.get(imageBlock.imageId)
          if (url) {
            URL.revokeObjectURL(url)
            objectUrlsRef.current.delete(imageBlock.imageId)
          }
        }

        imagesRef.current.delete(blockId)
        figure.remove()
        emitEditorInput(root)
        return
      }

      const open = target.closest<HTMLElement>('[data-image-open="true"]')
      if (open && root.contains(open)) {
        const figure = open.closest<HTMLElement>('[data-image-block="true"]')
        const blockId = figure?.dataset.blockId
        const block = blockId ? imagesRef.current.get(blockId) : null
        if (!block) return

        event.preventDefault()
        event.stopPropagation()
        void openImage(block)
      }
    }

    function handleImageInput(event: Event) {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.dataset.imageAlt !== 'true') return

      const figure = target.closest<HTMLElement>('[data-image-block="true"]')
      const blockId = figure?.dataset.blockId
      const block = blockId ? imagesRef.current.get(blockId) : null
      if (!block) return

      const next: ImageBlock = { ...block, alt: target.value }
      imagesRef.current.set(block.id, next)
      const image = figure?.querySelector<HTMLImageElement>('[data-image-element="true"]')
      if (image) image.alt = target.value.trim() || block.name
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
      if (event.key === 'Escape') setPreview(null)
    }

    root.addEventListener('mousedown', handleMouseDown, true)
    root.addEventListener('click', handleClick, true)
    root.addEventListener('input', handleImageInput, true)
    root.addEventListener('paste', handlePaste, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      observer.disconnect()
      root.removeEventListener('mousedown', handleMouseDown, true)
      root.removeEventListener('click', handleClick, true)
      root.removeEventListener('input', handleImageInput, true)
      root.removeEventListener('paste', handlePaste, true)
      document.removeEventListener('keydown', handleKeyDown)

      for (const url of objectUrlsRef.current.values()) URL.revokeObjectURL(url)
      objectUrlsRef.current.clear()
    }
  }, [noteId])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    await insertFiles(files)
  }

  return (
    <div ref={rootRef} className="image-note-editor-root">
      <CodeBlockEditor
        noteId={noteId}
        initialBlocks={initialEditorBlocksRef.current}
        onChange={handleEditorChange}
        onBlur={onBlur}
      />

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
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}>
          <div className="image-lightbox__content" onClick={(event) => event.stopPropagation()}>
            <button className="image-lightbox__close" type="button" onClick={() => setPreview(null)} aria-label="Cerrar imagen">×</button>
            <img src={preview.url} alt={preview.name} />
          </div>
        </div>
      )}
    </div>
  )
}
