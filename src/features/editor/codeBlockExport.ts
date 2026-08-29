import {
  isAndroidNativeOutboundShare,
  sharePdfTextOnAndroid,
  shareTextFileOnAndroid,
} from '../../platform/android/outboundShare'
import { normalizeCodeLanguage, type CodeLanguage } from '../notes/noteTypes'
import { createBrowserTextPdf } from './browserPdfExport'

function exportStem(language: CodeLanguage): string {
  const label = language === 'plaintext' ? 'texto' : language
  return `oanix-bloque-${label}`
}

function exportTitle(language: CodeLanguage): string {
  return language === 'plaintext' ? 'OANIX · Texto' : `OANIX · ${language}`
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

export async function exportCodeBlockAsTxt(text: string, rawLanguage: unknown): Promise<void> {
  const language = normalizeCodeLanguage(rawLanguage)
  const fileName = `${exportStem(language)}.txt`
  const title = exportTitle(language)

  if (isAndroidNativeOutboundShare()) {
    await shareTextFileOnAndroid(title, fileName, text)
    return
  }

  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), fileName)
}

export async function exportCodeBlockAsPdf(text: string, rawLanguage: unknown): Promise<void> {
  const language = normalizeCodeLanguage(rawLanguage)
  const fileName = `${exportStem(language)}.pdf`
  const title = exportTitle(language)

  if (isAndroidNativeOutboundShare()) {
    await sharePdfTextOnAndroid(title, fileName, text)
    return
  }

  const pdf = await createBrowserTextPdf(text, title)
  downloadBlob(pdf, fileName)
}
