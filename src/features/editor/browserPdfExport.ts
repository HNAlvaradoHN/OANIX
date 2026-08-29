const PAGE_WIDTH_PT = 595
const PAGE_HEIGHT_PT = 842
const CANVAS_WIDTH = 1240
const CANVAS_HEIGHT = 1754
const MARGIN_X = 84
const HEADER_Y = 72
const BODY_TOP = 128
const BODY_BOTTOM = 82
const BODY_FONT_PX = 20
const BODY_LINE_HEIGHT = 28
const MAX_PDF_PAGES = 250

const encoder = new TextEncoder()

type PdfPageImage = {
  bytes: Uint8Array
  width: number
  height: number
}

function clampInteger(value: number, minimum: number): number {
  return Math.max(minimum, Math.floor(value))
}

function countVisualLines(text: string, maxChars: number, stopAfter: number): number {
  if (!text) return 1

  let count = 0
  let start = 0
  for (let index = 0; index <= text.length; index += 1) {
    const code = index < text.length ? text.charCodeAt(index) : 10
    if (code !== 10 && code !== 13) continue

    const rawLength = index - start
    count += Math.max(1, Math.ceil(rawLength / maxChars))
    if (count > stopAfter) return count

    if (code === 13 && text.charCodeAt(index + 1) === 10) index += 1
    start = index + 1
  }
  return Math.max(1, count)
}

function* visualLines(text: string, maxChars: number): Generator<string> {
  let start = 0
  for (let index = 0; index <= text.length; index += 1) {
    const code = index < text.length ? text.charCodeAt(index) : 10
    if (code !== 10 && code !== 13) continue

    const line = text.slice(start, index).replaceAll('\t', '    ')
    if (!line) {
      yield ''
    } else {
      for (let offset = 0; offset < line.length; offset += maxChars) {
        yield line.slice(offset, offset + maxChars)
      }
    }

    if (code === 13 && text.charCodeAt(index + 1) === 10) index += 1
    start = index + 1
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('El navegador no pudo preparar una página del PDF.'))
    }, 'image/jpeg', 0.94)
  })
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

async function renderPage(lines: string[], title: string, pageNumber: number): Promise<PdfPageImage> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('El navegador no ofrece un lienzo compatible para exportar PDF.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.fillStyle = '#111827'
  context.font = '600 24px system-ui, sans-serif'
  context.textBaseline = 'alphabetic'
  context.fillText(title, MARGIN_X, HEADER_Y)

  context.fillStyle = '#111111'
  context.font = `${BODY_FONT_PX}px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`
  let y = BODY_TOP
  for (const line of lines) {
    context.fillText(line, MARGIN_X, y)
    y += BODY_LINE_HEIGHT
  }

  context.fillStyle = '#6b7280'
  context.font = '16px system-ui, sans-serif'
  context.fillText(`OANIX · ${pageNumber}`, MARGIN_X, CANVAS_HEIGHT - 36)

  const jpeg = await canvasToJpeg(canvas)
  return {
    bytes: new Uint8Array(await jpeg.arrayBuffer()),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  }
}

function ascii(value: string): Uint8Array {
  return encoder.encode(value)
}

function buildPdf(pageImages: PdfPageImage[]): Blob {
  const pageObjectIds = pageImages.map((_, index) => 3 + index * 3)
  const objectCount = 2 + pageImages.length * 3
  const objects = new Map<number, Uint8Array[]>()

  objects.set(1, [ascii('<< /Type /Catalog /Pages 2 0 R >>')])
  objects.set(2, [ascii(`<< /Type /Pages /Count ${pageImages.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`)])

  pageImages.forEach((page, index) => {
    const pageId = pageObjectIds[index]
    const imageId = pageId + 1
    const contentId = pageId + 2
    const imageName = `Im${index + 1}`
    const content = `q\n${PAGE_WIDTH_PT} 0 0 ${PAGE_HEIGHT_PT} 0 0 cm\n/${imageName} Do\nQ\n`

    objects.set(pageId, [ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )])
    objects.set(imageId, [
      ascii(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.byteLength} >>\nstream\n`),
      page.bytes,
      ascii('\nendstream'),
    ])
    objects.set(contentId, [
      ascii(`<< /Length ${encoder.encode(content).byteLength} >>\nstream\n${content}endstream`),
    ])
  })

  const chunks: Uint8Array[] = [ascii('%PDF-1.4\n% OANIX\n')]
  const offsets = new Array<number>(objectCount + 1).fill(0)
  let totalLength = chunks[0].byteLength

  for (let id = 1; id <= objectCount; id += 1) {
    const body = objects.get(id)
    if (!body) throw new Error('No se pudo ensamblar el PDF.')
    offsets[id] = totalLength
    const prefix = ascii(`${id} 0 obj\n`)
    const suffix = ascii('\nendobj\n')
    chunks.push(prefix, ...body, suffix)
    totalLength += prefix.byteLength + suffix.byteLength + body.reduce((sum, part) => sum + part.byteLength, 0)
  }

  const xrefOffset = totalLength
  const xref = [
    `xref\n0 ${objectCount + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join('')
  chunks.push(ascii(xref))

  return new Blob(chunks, { type: 'application/pdf' })
}

export async function createBrowserTextPdf(text: string, title: string): Promise<Blob> {
  const probe = document.createElement('canvas')
  const context = probe.getContext('2d')
  if (!context) throw new Error('El navegador no puede medir el texto para exportarlo.')
  context.font = `${BODY_FONT_PX}px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`
  const characterWidth = Math.max(1, context.measureText('M').width)
  const maxChars = clampInteger((CANVAS_WIDTH - MARGIN_X * 2) / characterWidth, 24)
  const linesPerPage = clampInteger((CANVAS_HEIGHT - BODY_TOP - BODY_BOTTOM) / BODY_LINE_HEIGHT, 1)
  const maximumVisualLines = linesPerPage * MAX_PDF_PAGES
  const estimatedLines = countVisualLines(text, maxChars, maximumVisualLines)

  if (estimatedLines > maximumVisualLines) {
    throw new Error(`Este bloque supera ${MAX_PDF_PAGES} páginas de PDF. Para textos tan extensos usa Exportar TXT.`)
  }

  const pages: PdfPageImage[] = []
  let pageLines: string[] = []
  let pageNumber = 1

  for (const line of visualLines(text, maxChars)) {
    pageLines.push(line)
    if (pageLines.length < linesPerPage) continue

    pages.push(await renderPage(pageLines, title, pageNumber))
    pageLines = []
    pageNumber += 1
    await yieldToBrowser()
  }

  if (pageLines.length > 0 || pages.length === 0) {
    pages.push(await renderPage(pageLines, title, pageNumber))
  }

  return buildPdf(pages)
}
