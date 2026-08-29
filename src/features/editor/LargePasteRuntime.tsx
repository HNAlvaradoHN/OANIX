import { useEffect } from 'react'
import { shouldEncapsulateClipboardPaste } from './largePastePolicy'
import './mobileEditorStability.css'

function selectionInsideEditor(editor: HTMLElement): boolean {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return false
  return editor.contains(selection.getRangeAt(0).commonAncestorContainer)
}

function ensureEditorSelection(editor: HTMLElement, target: Element): boolean {
  if (selectionInsideEditor(editor)) return true

  const targetBlock = target.closest<HTMLElement>('[data-block-id]')
  const anchor = targetBlock && editor.contains(targetBlock)
    ? targetBlock
    : editor.lastElementChild instanceof HTMLElement
      ? editor.lastElementChild
      : editor

  const selection = document.getSelection()
  if (!selection) return false

  editor.focus({ preventScroll: true })
  const range = document.createRange()
  range.selectNodeContents(anchor)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  return selectionInsideEditor(editor)
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

      // Android/PWA clipboard menus may dispatch paste after the platform has
      // temporarily dropped the DOM Selection. Rebuild a safe caret from the
      // actual paste target instead of allowing the normal large-text path.
      if (!ensureEditorSelection(editor, target)) {
        event.preventDefault()
        event.stopPropagation()
        window.alert('OANIX no pudo ubicar el pegado grande dentro de la nota. El contenido sigue disponible en tu portapapeles.')
        return
      }

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
      content.focus({ preventScroll: true })
      content.dispatchEvent(new Event('input', { bubbles: true }))
    }

    document.addEventListener('paste', handlePaste, true)
    return () => document.removeEventListener('paste', handlePaste, true)
  }, [])

  return null
}
