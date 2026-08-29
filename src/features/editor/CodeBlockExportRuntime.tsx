import { useEffect } from 'react'
import { exportCodeBlockAsPdf, exportCodeBlockAsTxt } from './codeBlockExport'

function codeText(block: HTMLElement): string {
  const content = block.querySelector<HTMLElement>('[data-code-content="true"]')
  return (content?.innerText ?? '').replace(/\r\n?/g, '\n').replaceAll('\u00a0', ' ')
}

function closeMenu(button: Element): void {
  const block = button.closest<HTMLElement>('[data-code-block="true"]')
  const menu = button.closest<HTMLElement>('[data-code-actions-menu="true"]')
  const toggle = block?.querySelector<HTMLButtonElement>('[data-code-actions-toggle="true"]')
  if (menu) menu.hidden = true
  if (toggle) toggle.setAttribute('aria-expanded', 'false')
  if (block) {
    delete block.dataset.codeMenuOpen
    delete block.dataset.codeMenuDirection
  }
}

function convertButtonsWithin(root: ParentNode): HTMLButtonElement[] {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-code-convert="true"]'))
  if (root instanceof HTMLButtonElement && root.matches('[data-code-convert="true"]')) {
    buttons.unshift(root)
  }
  return buttons
}

function decorateExportActions(root: ParentNode = document): void {
  convertButtonsWithin(root).forEach((convert) => {
    delete convert.dataset.codeConvert
    convert.dataset.codeExportTxt = 'true'
    convert.textContent = 'Exportar TXT'
    convert.title = 'Guardar o compartir todo el contenido como archivo .txt'

    const menu = convert.parentElement
    if (!menu || menu.querySelector('[data-code-export-pdf="true"]')) return

    const exportPdf = document.createElement('button')
    exportPdf.type = 'button'
    exportPdf.className = 'editor-code-block__menu-action'
    exportPdf.dataset.codeExportPdf = 'true'
    exportPdf.textContent = 'Exportar PDF'
    exportPdf.title = 'Guardar o compartir todo el contenido como archivo .pdf'
    exportPdf.setAttribute('role', 'menuitem')
    convert.after(exportPdf)
  })
}

function showExportStatus(message: string): () => void {
  document.querySelector('[data-code-export-status="true"]')?.remove()
  const status = document.createElement('div')
  status.dataset.codeExportStatus = 'true'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.textContent = message
  Object.assign(status.style, {
    position: 'fixed',
    zIndex: '3600',
    left: '50%',
    bottom: 'max(1rem, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    maxWidth: 'calc(100vw - 2rem)',
    padding: '.7rem .9rem',
    borderRadius: '.8rem',
    background: 'rgba(15, 23, 42, .96)',
    color: '#f8fafc',
    boxShadow: '0 12px 36px rgba(0, 0, 0, .28)',
    fontSize: '.86rem',
    fontWeight: '650',
  })
  document.body.append(status)
  return () => status.remove()
}

export function CodeBlockExportRuntime() {
  useEffect(() => {
    decorateExportActions()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) decorateExportActions(node)
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // Android WebView occasionally loses the synthetic click after a selection
    // or scroll gesture. On coarse pointers, promote the deliberate pointerdown
    // on the three-dot button into the same click path owned by CodeBlockEditor.
    // preventDefault suppresses the later native compatibility click, avoiding a
    // double toggle while keeping desktop mouse behavior untouched.
    function handleTouchMenuPointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' || event.button !== 0) return
      const target = event.target
      if (!(target instanceof Element)) return
      const toggle = target.closest<HTMLButtonElement>('[data-code-actions-toggle="true"]')
      if (!toggle) return

      event.preventDefault()
      event.stopPropagation()
      toggle.click()
    }

    async function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const txt = target.closest<HTMLButtonElement>('[data-code-export-txt="true"]')
      const pdf = target.closest<HTMLButtonElement>('[data-code-export-pdf="true"]')
      const action = txt ?? pdf
      if (!action || action.dataset.exportBusy === 'true') return

      const block = action.closest<HTMLElement>('[data-code-block="true"]')
      if (!block) return

      event.preventDefault()
      event.stopPropagation()
      closeMenu(action)
      action.dataset.exportBusy = 'true'
      action.disabled = true
      const dismissStatus = showExportStatus(txt ? 'Preparando archivo TXT…' : 'Preparando archivo PDF…')

      try {
        if (txt) await exportCodeBlockAsTxt(codeText(block), block.dataset.language)
        else await exportCodeBlockAsPdf(codeText(block), block.dataset.language)
      } catch (error) {
        window.alert(error instanceof Error
          ? error.message
          : txt
            ? 'No se pudo exportar el bloque como TXT.'
            : 'No se pudo exportar el bloque como PDF.')
      } finally {
        dismissStatus()
        delete action.dataset.exportBusy
        action.disabled = false
      }
    }

    document.addEventListener('pointerdown', handleTouchMenuPointerDown, true)
    document.addEventListener('click', handleClick, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', handleTouchMenuPointerDown, true)
      document.removeEventListener('click', handleClick, true)
      document.querySelector('[data-code-export-status="true"]')?.remove()
    }
  }, [])

  return null
}
