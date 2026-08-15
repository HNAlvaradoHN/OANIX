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

  block.replaceWith(paragraph)
  placeCaretAtEnd(paragraph)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  editor.focus()
}

function decorateCodeBlocks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.editor-code-block__toolbar').forEach((toolbar) => {
    if (toolbar.querySelector('[data-code-remove="true"]')) return

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'editor-code-block__remove'
    button.dataset.codeRemove = 'true'
    button.textContent = 'Quitar bloque'
    button.title = 'Quitar el formato de código y conservar el texto'
    button.setAttribute('aria-label', 'Quitar bloque de código y conservar el texto')

    const copyButton = toolbar.querySelector('[data-code-copy="true"]')
    toolbar.insertBefore(button, copyButton)
  })
}

export function CodeBlockEditor(props: CodeBlockEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const currentRoot = rootRef.current
    if (!currentRoot) return
    const root: HTMLDivElement = currentRoot

    decorateCodeBlocks(root)

    const observer = new MutationObserver(() => decorateCodeBlocks(root))
    observer.observe(root, { childList: true, subtree: true })

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const removeButton = target.closest<HTMLElement>('[data-code-remove="true"]')
      if (removeButton && root.contains(removeButton)) {
        const block = removeButton.closest<HTMLElement>('[data-code-block="true"]')
        if (!block) return

        event.preventDefault()
        event.stopPropagation()
        convertCodeBlockToText(root, block)
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

    root.addEventListener('click', handleClick, true)

    return () => {
      observer.disconnect()
      root.removeEventListener('click', handleClick, true)
    }
  }, [props.noteId])

  return (
    <div ref={rootRef} className="code-block-editor-root">
      <RichTextEditor {...props} />
    </div>
  )
}
