import { useEffect } from 'react'
import { shouldEncapsulateClipboardPaste } from './largePastePolicy'

function selectionInsideEditor(editor: HTMLElement): boolean {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return false
  return editor.contains(selection.getRangeAt(0).commonAncestorContainer)
}

function codeContentFromBlock(block: HTMLElement | null): HTMLElement | null {
  return block?.querySelector<HTMLElement>('[data-code-content="true"]') ?? null
}

export function LargePasteRuntime() {
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return
      if (target.closest('[data-contact-field], [data-daily-entry-title="true"]')) return
      if (target.closest('[data-code-content="true"]')) return

      const plainText = event.clipboardData?.getData('text/plain') ?? ''
      if (!plainText || !shouldEncapsulateClipboardPaste(plainText)) return
      if (!selectionInsideEditor(editor)) return

      const frame = editor.closest<HTMLElement>('.editor-frame')
      const codeTool = frame?.querySelector<HTMLButtonElement>('[data-format="code"]')
      if (!codeTool) return

      const existingBlocks = new Set(
        Array.from(editor.querySelectorAll<HTMLElement>('[data-code-block="true"]')),
      )

      event.preventDefault()
      event.stopPropagation()
      codeTool.click()

      const insertedBlock = Array.from(
        editor.querySelectorAll<HTMLElement>('[data-code-block="true"]'),
      ).find((block) => !existingBlocks.has(block)) ?? null
      const activeContent = document.activeElement instanceof Element
        ? document.activeElement.closest<HTMLElement>('[data-code-content="true"]')
        : null
      const content = activeContent && editor.contains(activeContent)
        ? activeContent
        : codeContentFromBlock(insertedBlock)

      if (!content) {
        window.alert('OANIX no pudo preparar el bloque para este pegado grande. El contenido sigue disponible en tu portapapeles.')
        return
      }

      content.textContent = plainText
      content.focus()
      content.dispatchEvent(new Event('input', { bubbles: true }))
    }

    document.addEventListener('paste', handlePaste, true)
    return () => document.removeEventListener('paste', handlePaste, true)
  }, [])

  return null
}
