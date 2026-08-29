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

function decorateExportActions(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('[data-code-convert="true"]').forEach((convert) => {
    delete convert.dataset.codeConvert
    convert.dataset.codeExportTxt = 'true'
    convert.textContent = 'Exportar TXT'
    convert.title = 'Guardar todo el contenido como archivo .txt'

    const menu = convert.parentElement
    if (!menu || menu.querySelector('[data-code-export-pdf="true"]')) return

    const exportPdf = document.createElement('button')
    exportPdf.type = 'button'
    exportPdf.className = 'editor-code-block__menu-action'
    exportPdf.dataset.codeExportPdf = 'true'
    exportPdf.textContent = 'Exportar PDF'
    exportPdf.title = 'Preparar el contenido para guardarlo como PDF'
    exportPdf.setAttribute('role', 'menuitem')
    convert.after(exportPdf)
  })
}

export function CodeBlockExportRuntime() {
  useEffect(() => {
    decorateExportActions()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element && node.querySelector('[data-code-convert="true"]')) {
            decorateExportActions(node)
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const txt = target.closest<HTMLElement>('[data-code-export-txt="true"]')
      const pdf = target.closest<HTMLElement>('[data-code-export-pdf="true"]')
      const action = txt ?? pdf
      if (!action) return

      const block = action.closest<HTMLElement>('[data-code-block="true"]')
      if (!block) return

      event.preventDefault()
      event.stopPropagation()
      closeMenu(action)

      try {
        if (txt) exportCodeBlockAsTxt(codeText(block), block.dataset.language)
        else exportCodeBlockAsPdf(codeText(block), block.dataset.language)
      } catch {
        window.alert(txt
          ? 'No se pudo exportar el bloque como TXT.'
          : 'No se pudo preparar el PDF en este navegador.')
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  return null
}
