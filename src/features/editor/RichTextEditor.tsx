import { useEffect, useRef, useState, type ClipboardEvent } from 'react'
import {
  normalizeNoteLink,
  noteBlocksToPlainText,
  type NoteBlock,
  type RichTextRun,
} from '../notes/noteTypes'
import './editor.css'

interface RichTextEditorProps {
  noteId: string
  initialBlocks: NoteBlock[]
  onChange: (blocks: NoteBlock[]) => void
  onBlur: () => void
}

interface RunStyle {
  bold?: boolean
  italic?: boolean
  href?: string
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function runToHtml(run: RichTextRun): string {
  let html = escapeHtml(run.text).replaceAll('\n', '<br>')

  if (run.bold) html = `<strong>${html}</strong>`
  if (run.italic) html = `<em>${html}</em>`
  if (run.href) html = `<a href="${escapeHtml(run.href)}">${html}</a>`

  return html
}

function runsToHtml(runs: RichTextRun[]): string {
  const html = runs.map(runToHtml).join('')
  return html || '<br>'
}

function blocksToHtml(blocks: NoteBlock[]): string {
  if (blocks.length === 0) {
    return `<p data-block-id="${createBlockId()}"><br></p>`
  }

  return blocks
    .map((block) => {
      const id = escapeHtml(block.id)

      if (block.type === 'divider') return `<hr data-block-id="${id}">`
      if (block.type === 'heading') {
        return `<h${block.level} data-block-id="${id}">${runsToHtml(block.runs)}</h${block.level}>`
      }
      if (block.type === 'quote') {
        return `<blockquote data-block-id="${id}">${runsToHtml(block.runs)}</blockquote>`
      }
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        const tag = block.type === 'bulletList' ? 'ul' : 'ol'
        const items = block.items.map((item) => `<li>${runsToHtml(item)}</li>`).join('')
        return `<${tag} data-block-id="${id}">${items || '<li><br></li>'}</${tag}>`
      }

      return `<p data-block-id="${id}">${runsToHtml(block.runs)}</p>`
    })
    .join('')
}

function blockIdFromElement(element: HTMLElement): string {
  const current = element.dataset.blockId
  if (current && /^[A-Za-z0-9-]{8,}$/.test(current)) return current

  const id = createBlockId()
  element.dataset.blockId = id
  return id
}

function sameRunStyle(left: RichTextRun, right: RichTextRun): boolean {
  return left.bold === right.bold && left.italic === right.italic && left.href === right.href
}

function mergeRuns(runs: RichTextRun[]): RichTextRun[] {
  const merged: RichTextRun[] = []

  for (const run of runs) {
    if (run.text.length === 0) continue

    const previous = merged.at(-1)
    if (previous && sameRunStyle(previous, run)) {
      previous.text += run.text
    } else {
      merged.push({ ...run })
    }
  }

  if (merged.length === 1 && merged[0].text === '\n') return []
  return merged
}

function parseRuns(node: Node, inherited: RunStyle = {}): RichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.nodeValue ?? '').replaceAll('\u00a0', ' ')
    return text ? [{ text, ...inherited }] : []
  }

  if (!(node instanceof HTMLElement)) return []

  const tag = node.tagName.toLowerCase()
  if (tag === 'br') return [{ text: '\n', ...inherited }]

  const style: RunStyle = { ...inherited }
  if (tag === 'strong' || tag === 'b') style.bold = true
  if (tag === 'em' || tag === 'i') style.italic = true

  if (tag === 'a') {
    const safeHref = normalizeNoteLink(node.getAttribute('href') ?? '')
    if (safeHref) style.href = safeHref
  }

  return Array.from(node.childNodes).flatMap((child) => parseRuns(child, style))
}

function parseBlockRuns(element: HTMLElement): RichTextRun[] {
  return mergeRuns(Array.from(element.childNodes).flatMap((child) => parseRuns(child)))
}

function parseEditorBlocks(root: HTMLElement): NoteBlock[] {
  const blocks: NoteBlock[] = []

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue ?? '').trim()
      if (text) {
        blocks.push({ id: createBlockId(), type: 'paragraph', runs: [{ text }] })
      }
      continue
    }

    if (!(node instanceof HTMLElement)) continue

    const tag = node.tagName.toLowerCase()
    const id = blockIdFromElement(node)

    if (tag === 'hr') {
      blocks.push({ id, type: 'divider' })
      continue
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      blocks.push({
        id,
        type: 'heading',
        level: Number(tag.slice(1)) as 1 | 2 | 3,
        runs: parseBlockRuns(node),
      })
      continue
    }

    if (tag === 'blockquote') {
      blocks.push({ id, type: 'quote', runs: parseBlockRuns(node) })
      continue
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === 'li')
        .map(parseBlockRuns)

      blocks.push({
        id,
        type: tag === 'ul' ? 'bulletList' : 'orderedList',
        items: items.length > 0 ? items : [[]],
      })
      continue
    }

    blocks.push({ id, type: 'paragraph', runs: parseBlockRuns(node) })
  }

  return blocks
}

function isEditorEmpty(blocks: NoteBlock[]): boolean {
  return blocks.every((block) => block.type !== 'divider') && noteBlocksToPlainText(blocks).length === 0
}

export function RichTextEditor({ noteId, initialBlocks, onChange, onBlur }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [empty, setEmpty] = useState(() => isEditorEmpty(initialBlocks))

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    editor.innerHTML = blocksToHtml(initialBlocks)
    setEmpty(isEditorEmpty(initialBlocks))
    // The component is keyed by note id. Content updates are deliberately not pushed back
    // into the live DOM while the user is typing, which preserves the browser selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  function emitChange() {
    const editor = editorRef.current
    if (!editor) return

    const blocks = parseEditorBlocks(editor)
    setEmpty(isEditorEmpty(blocks))
    onChange(blocks)
  }

  function runCommand(command: string, value?: string) {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    document.execCommand(command, false, value)
    emitChange()
  }

  function handleLink() {
    const editor = editorRef.current
    const selection = document.getSelection()
    if (!editor || !selection || selection.isCollapsed || !editor.contains(selection.commonAncestorContainer)) {
      return
    }

    const rawValue = window.prompt('Escribe el enlace. Déjalo vacío para quitar un enlace existente.')
    if (rawValue === null) return

    if (!rawValue.trim()) {
      runCommand('unlink')
      return
    }

    const href = normalizeNoteLink(rawValue)
    if (!href) {
      window.alert('El enlace debe usar http, https, mailto o tel.')
      return
    }

    runCommand('createLink', href)
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const plainText = event.clipboardData.getData('text/plain')
    if (!plainText) return

    event.preventDefault()
    document.execCommand('insertText', false, plainText)
    emitChange()
  }

  const keepSelection = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()

  return (
    <div className="editor-frame">
      <div className="editor-toolbar" role="toolbar" aria-label="Formato de texto">
        <button className="editor-tool editor-tool--strong" type="button" onMouseDown={keepSelection} onClick={() => runCommand('bold')} title="Negrita">
          B
        </button>
        <button className="editor-tool editor-tool--italic" type="button" onMouseDown={keepSelection} onClick={() => runCommand('italic')} title="Cursiva">
          I
        </button>
        <span className="editor-toolbar__separator" aria-hidden="true" />
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('formatBlock', 'p')} title="Párrafo">
          P
        </button>
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('formatBlock', 'h2')} title="Encabezado grande">
          H2
        </button>
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('formatBlock', 'h3')} title="Encabezado pequeño">
          H3
        </button>
        <span className="editor-toolbar__separator" aria-hidden="true" />
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('insertUnorderedList')} title="Lista con viñetas">
          • Lista
        </button>
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('insertOrderedList')} title="Lista numerada">
          1. Lista
        </button>
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('formatBlock', 'blockquote')} title="Cita">
          Cita
        </button>
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={handleLink} title="Enlace">
          Enlace
        </button>
        <button className="editor-tool" type="button" onMouseDown={keepSelection} onClick={() => runCommand('insertHorizontalRule')} title="Separador">
          —
        </button>
      </div>

      <div
        ref={editorRef}
        className="editor-surface"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Contenido de la nota"
        data-empty={empty ? 'true' : 'false'}
        data-placeholder="Escribe algo…"
        onInput={emitChange}
        onBlur={onBlur}
        onPaste={handlePaste}
        spellCheck
      />
    </div>
  )
}
