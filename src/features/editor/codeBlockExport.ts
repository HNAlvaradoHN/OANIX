import { normalizeCodeLanguage, type CodeLanguage } from '../notes/noteTypes'

function exportStem(language: CodeLanguage): string {
  const label = language === 'plaintext' ? 'texto' : language
  return `oanix-bloque-${label}`
}

export function exportCodeBlockAsTxt(text: string, rawLanguage: unknown): void {
  const language = normalizeCodeLanguage(rawLanguage)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${exportStem(language)}.txt`
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

export function exportCodeBlockAsPdf(text: string, rawLanguage: unknown): void {
  const language = normalizeCodeLanguage(rawLanguage)
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.width = '1px'
  frame.style.height = '1px'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.border = '0'
  frame.style.opacity = '0'
  frame.style.pointerEvents = 'none'
  document.body.append(frame)

  const printWindow = frame.contentWindow
  const printDocument = frame.contentDocument
  if (!printWindow || !printDocument) {
    frame.remove()
    throw new Error('Este navegador no permite preparar la exportación PDF.')
  }

  printDocument.open()
  printDocument.write('<!doctype html><html><head><meta charset="utf-8"><title></title></head><body></body></html>')
  printDocument.close()
  printDocument.title = `${exportStem(language)}.pdf`

  const style = printDocument.createElement('style')
  style.textContent = `
    @page { margin: 16mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; }
    body { font: 10pt/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
    h1 { margin: 0 0 12pt; font: 600 12pt/1.3 system-ui, sans-serif; }
    pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; }
  `
  printDocument.head.append(style)

  const title = printDocument.createElement('h1')
  title.textContent = language === 'plaintext' ? 'OANIX · Texto' : `OANIX · ${language}`
  const pre = printDocument.createElement('pre')
  pre.textContent = text
  printDocument.body.append(title, pre)

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    frame.remove()
  }
  printWindow.addEventListener('afterprint', cleanup, { once: true })

  window.setTimeout(() => {
    try {
      printWindow.focus()
      printWindow.print()
    } catch (error) {
      cleanup()
      throw error
    }
    window.setTimeout(cleanup, 60_000)
  }, 0)
}
