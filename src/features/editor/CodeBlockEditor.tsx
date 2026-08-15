import { useEffect, useRef, type ComponentProps } from 'react'
import { RichTextEditor } from './RichTextEditor'
import './codeBlockEditor.css'

type CodeBlockEditorProps = ComponentProps<typeof RichTextEditor>

function createBlockId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser.')
  }

  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function codeText(block: HTMLElement): string {
  const content = block.querySelector<HTMLElement>('[data-code-content="true"]')
  return (content?.innerText ?? '').replace(/\r\n?/g, '\n').replaceAll('\u00a0', ' ')
}

function codeBlockFromSelection(root: HTMLElement): HTMLElement | null {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const anchor = selection.anchorNode
  const element = anchor instanceof Element ? anchor : anchor?.parentElement
  const block = element?.closest<HTMLElement>('[data-code-block="true"]') ?? null
  return block && root.contains(block) ? block : null
}

function placeCaretAtEnd(element: HTMLElement): void {
  const selection = document.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

function createEmptyParagraph(): HTMLParagraphElement {
  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = createBlockId()
  paragraph.appendChild(document.createElement('br'))
  return paragraph
}

function authorizeProtectedRemoval(editor: HTMLElement, block: HTMLElement): string | null {
  const blockId = block.dataset.blockId ?? null
  if (blockId) editor.dataset.oanixAuthorizedProtectedRemoval = blockId
  return blockId
}

function clearProtectedRemovalAuthorization(editor: HTMLElement, blockId: string | null): void {
  if (blockId && editor.dataset.oanixAuthorizedProtectedRemoval === blockId) {
    delete editor.dataset.oanixAuthorizedProtectedRemoval
  }
}

function convertCodeBlockToText(root: HTMLElement, block: HTMLElement): void {
  const editor = root.querySelector<HTMLElement>('.editor-surface')
  if (!editor || !editor.contains(block)) return

  const paragraph = document.createElement('p')
  paragraph.dataset.blockId = createBlockId()

  const text = codeText(block)
  if (text) {
    paragraph.textContent = text
  } else {
    paragraph.appendChild(document.createElement('br'))
  }

  const authorizedBlockId = authorizeProtectedRemoval(editor, block)
  block.replaceWith(paragraph)
  placeCaretAtEnd(paragraph)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  clearProtectedRemovalAuthorization(editor, authorizedBlockId)
  editor.focus()
}

function deleteCodeBlock(root: HTMLElement, block: HTMLElement): void {
  const editor = root.querySelector<HTMLElement>('.editor-surface')
  if (!editor || !editor.contains(block)) return

  const previous = block.previousElementSibling instanceof HTMLElement ? block.previousElementSibling : null
  const next = block.nextElementSibling instanceof HTMLElement ? block.nextElementSibling : null
  const authorizedBlockId = authorizeProtectedRemoval(editor, block)
  block.remove()

  let focusTarget = next ?? previous
  if (!focusTarget) {
    const paragraph = createEmptyParagraph()
    editor.appendChild(paragraph)
    focusTarget = paragraph
  }

  const codeContent = focusTarget.querySelector<HTMLElement>('[data-code-content="true"]')
  const caretTarget = codeContent ?? focusTarget
  placeCaretAtEnd(caretTarget)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  clearProtectedRemovalAuthorization(editor, authorizedBlockId)
  editor.focus()
}

function decorateCodeBlocks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.editor-code-block__toolbar').forEach((toolbar) => {
    const copyButton = toolbar.querySelector('[data-code-copy="true"]')

    if (!toolbar.querySelector('[data-code-convert="true"]')) {
      const convert = document.createElement('button')
      convert.type = 'button'
      convert.className = 'editor-code-block__convert'
      convert.dataset.codeConvert = 'true'
      convert.textContent = 'Convertir a texto'
      convert.title = 'Quitar el formato de código y conservar todo el contenido'
      convert.setAttribute('aria-label', 'Convertir bloque de código a texto conservando el contenido')

      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'editor-code-block__delete'
      remove.dataset.codeDelete = 'true'
      remove.textContent = 'Eliminar bloque'
      remove.title = 'Eliminar el bloque y todo su contenido'
      remove.setAttribute('aria-label', 'Eliminar bloque de código y su contenido')

      toolbar.insertBefore(convert, copyButton)
      toolbar.insertBefore(remove, copyButton)
    }

    if (!toolbar.querySelector('[data-code-expand="true"]')) {
      const expand = document.createElement('button')
      expand.type = 'button'
      expand.className = 'editor-code-block__expand'
      expand.dataset.codeExpand = 'true'
      expand.textContent = 'Ver completo'
      expand.title = 'Ver y editar código en pantalla completa'
      expand.setAttribute('aria-label', 'Ver código completo y editarlo en pantalla completa')
      toolbar.insertBefore(expand, copyButton)
    }
  })
}

interface CodeFullscreenDialog {
  element: HTMLElement
  close: () => void
}

function createCodeFullscreenDialog(
  root: HTMLElement,
  block: HTMLElement,
  onClose: () => void,
): CodeFullscreenDialog | null {
  const editor = root.querySelector<HTMLElement>('.editor-surface')
  const sourceContent = block.querySelector<HTMLElement>('[data-code-content="true"]')
  const sourceLanguage = block.querySelector<HTMLSelectElement>('[data-code-language="true"]')
  if (!editor || !sourceContent || !sourceLanguage) return null
  const sourceContentElement: HTMLElement = sourceContent
  const sourceLanguageElement: HTMLSelectElement = sourceLanguage

  const backdrop = document.createElement('div')
  backdrop.className = 'code-fullscreen-dialog'
  backdrop.setAttribute('role', 'presentation')

  const panel = document.createElement('div')
  panel.className = 'code-fullscreen-dialog__panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-label', 'Editor de código completo')

  const header = document.createElement('div')
  header.className = 'code-fullscreen-dialog__header'

  const title = document.createElement('strong')
  title.textContent = 'Código completo'

  const done = document.createElement('button')
  done.type = 'button'
  done.className = 'code-fullscreen-dialog__done'
  done.textContent = 'Listo'
  done.setAttribute('aria-label', 'Guardar cambios del código y cerrar')

  header.append(title, done)

  const language = sourceLanguageElement.cloneNode(true) as HTMLSelectElement
  language.className = 'code-fullscreen-dialog__language'
  language.removeAttribute('data-code-language')
  language.value = sourceLanguageElement.value
  language.setAttribute('aria-label', 'Lenguaje del código completo')

  const textarea = document.createElement('textarea')
  textarea.className = 'code-fullscreen-dialog__editor'
  textarea.value = codeText(block)
  textarea.spellcheck = false
  textarea.autocapitalize = 'off'
  textarea.autocomplete = 'off'
  textarea.setAttribute('aria-label', 'Contenido completo del bloque de código')
  textarea.setAttribute('wrap', 'soft')

  const hint = document.createElement('p')
  hint.className = 'code-fullscreen-dialog__hint'
  hint.textContent = 'Las líneas largas se ajustan solo en pantalla; OANIX no agrega saltos al código.'

  panel.append(header, language, textarea, hint)
  backdrop.append(panel)

  const previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.body.append(backdrop)
  textarea.focus()
  textarea.setSelectionRange(textarea.value.length, textarea.value.length)

  let closed = false
  function close() {
    if (closed) return
    closed = true

    if (block.isConnected && root.contains(block)) {
      sourceContentElement.textContent = textarea.value
      sourceLanguageElement.value = language.value
      block.dataset.language = language.value
      Array.from(sourceLanguageElement.options).forEach((option) => {
        option.toggleAttribute('selected', option.value === language.value)
      })

      sourceContentElement.focus()
      placeCaretAtEnd(sourceContentElement)
      sourceContentElement.dispatchEvent(new Event('input', { bubbles: true }))
    }

    document.body.style.overflow = previousBodyOverflow
    backdrop.remove()
    onClose()
  }

  done.addEventListener('click', close)
  textarea.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    textarea.setRangeText('	', start, end, 'end')
  })

  return { element: backdrop, close }
}

function createDeleteDialog(
  root: HTMLElement,
  block: HTMLElement,
  onClose: () => void,
): HTMLElement {
  const backdrop = document.createElement('div')
  backdrop.className = 'code-delete-dialog'
  backdrop.setAttribute('role', 'presentation')

  const dialog = document.createElement('div')
  dialog.className = 'code-delete-dialog__panel'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-labelledby', 'oanix-code-delete-title')
  dialog.setAttribute('aria-describedby', 'oanix-code-delete-description')

  const title = document.createElement('h3')
  title.id = 'oanix-code-delete-title'
  title.textContent = 'Eliminar bloque de código'

  const description = document.createElement('p')
  description.id = 'oanix-code-delete-description'
  description.textContent =
    'Se eliminará este bloque y todo el código que contiene. Puedes recuperarlo con Deshacer mientras sigas en esta nota.'

  const actions = document.createElement('div')
  actions.className = 'code-delete-dialog__actions'

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'code-delete-dialog__cancel'
  cancel.textContent = 'Cancelar'

  const confirm = document.createElement('button')
  confirm.type = 'button'
  confirm.className = 'code-delete-dialog__confirm'
  confirm.textContent = 'Eliminar bloque'

  actions.append(cancel, confirm)
  dialog.append(title, description, actions)
  backdrop.append(dialog)

  function close() {
    backdrop.remove()
    onClose()
  }

  cancel.addEventListener('click', close)
  confirm.addEventListener('click', () => {
    if (block.isConnected && root.contains(block)) {
      deleteCodeBlock(root, block)
    }
    close()
  })
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close()
  })

  document.body.append(backdrop)
  cancel.focus()
  return backdrop
}

export function CodeBlockEditor(props: CodeBlockEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const currentRoot = rootRef.current
    if (!currentRoot) return
    const root: HTMLDivElement = currentRoot
    let activeDialog: HTMLElement | null = null
    let activeFullscreenDialog: CodeFullscreenDialog | null = null

    decorateCodeBlocks(root)

    const observer = new MutationObserver(() => decorateCodeBlocks(root))
    observer.observe(root, { childList: true, subtree: true })

    function closeActiveDialog() {
      activeDialog?.remove()
      activeDialog = null
    }

    function closeFullscreenDialog() {
      const dialog = activeFullscreenDialog
      activeFullscreenDialog = null
      dialog?.close()
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const convertButton = target.closest<HTMLElement>('[data-code-convert="true"]')
      if (convertButton && root.contains(convertButton)) {
        const block = convertButton.closest<HTMLElement>('[data-code-block="true"]')
        if (!block) return

        event.preventDefault()
        event.stopPropagation()
        convertCodeBlockToText(root, block)
        return
      }

      const expandButton = target.closest<HTMLElement>('[data-code-expand="true"]')
      if (expandButton && root.contains(expandButton)) {
        const block = expandButton.closest<HTMLElement>('[data-code-block="true"]')
        if (!block) return

        event.preventDefault()
        event.stopPropagation()
        closeActiveDialog()
        closeFullscreenDialog()
        activeFullscreenDialog = createCodeFullscreenDialog(root, block, () => {
          activeFullscreenDialog = null
        })
        return
      }

      const deleteButton = target.closest<HTMLElement>('[data-code-delete="true"]')
      if (deleteButton && root.contains(deleteButton)) {
        const block = deleteButton.closest<HTMLElement>('[data-code-block="true"]')
        if (!block) return

        event.preventDefault()
        event.stopPropagation()
        closeActiveDialog()
        activeDialog = createDeleteDialog(root, block, () => {
          activeDialog = null
        })
        return
      }

      const codeTool = target.closest<HTMLButtonElement>('[data-format="code"]')
      if (!codeTool || !root.contains(codeTool) || codeTool.getAttribute('aria-pressed') !== 'true') {
        return
      }

      const block = codeBlockFromSelection(root)
      if (!block) return

      event.preventDefault()
      event.stopPropagation()
      convertCodeBlockToText(root, block)
    }

    function syncCodeSelectionMode() {
      root.querySelectorAll<HTMLElement>('[data-code-block="true"]').forEach((block) => {
        delete block.dataset.codeSelectionLocal
      })

      const selection = document.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const elementFor = (node: Node | null): Element | null =>
        node instanceof Element ? node : node?.parentElement ?? null
      const anchorContent = elementFor(selection.anchorNode)?.closest<HTMLElement>('[data-code-content="true"]') ?? null
      const focusContent = elementFor(selection.focusNode)?.closest<HTMLElement>('[data-code-content="true"]') ?? null

      if (!anchorContent || anchorContent !== focusContent || !root.contains(anchorContent)) return
      const block = anchorContent.closest<HTMLElement>('[data-code-block="true"]')
      if (block) block.dataset.codeSelectionLocal = 'true'
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      if (activeFullscreenDialog) {
        event.preventDefault()
        closeFullscreenDialog()
        return
      }

      if (activeDialog) {
        event.preventDefault()
        closeActiveDialog()
      }
    }

    root.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('selectionchange', syncCodeSelectionMode)
    syncCodeSelectionMode()

    return () => {
      observer.disconnect()
      root.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('selectionchange', syncCodeSelectionMode)
      closeActiveDialog()
      closeFullscreenDialog()
    }
  }, [props.noteId])

  return (
    <div ref={rootRef} className="code-block-editor-root">
      <RichTextEditor {...props} />
    </div>
  )
}
