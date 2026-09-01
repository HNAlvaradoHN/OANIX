import { Fragment, useEffect, useState } from 'react'
import {
  CHECKLIST_BLOCK_KIND,
  MAX_CHECKLIST_ITEMS,
  decodeChecklistBlock,
  encodeChecklistBlock,
  type EditorChecklistBlock,
} from '../checklistBlockCodec.ts'
import {
  CODE_BLOCK_KIND,
  MAX_CODE_BLOCK_LANGUAGE_LENGTH,
  MAX_CODE_BLOCK_TEXT_LENGTH,
  decodeCodeBlock,
  encodeCodeBlock,
  type EditorCodeBlock,
} from '../codeBlockCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
  type EditorTextBlock,
} from '../textBlockCodec.ts'
import type { EditorBlockSession } from '../editorBlockSession.ts'
import type { EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import './qwenChecklistBlocks.css'
import './qwenCodeBlocks.css'
import './qwenTextBlocks.css'

interface QwenRichBlocksProps {
  session: EditorBlockSession
  disabled: boolean
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
}

type InsertBlockKind = 'text' | 'checklist' | 'code'

function newTextBlockId(): string {
  return `text-${crypto.randomUUID()}`
}

function newChecklistId(): string {
  return `checklist-${crypto.randomUUID()}`
}

function newCodeBlockId(): string {
  return `code-${crypto.randomUUID()}`
}

function withChecklistItem(
  block: EditorChecklistBlock,
  itemIndex: number,
  updater: (item: EditorChecklistBlock['items'][number]) => EditorChecklistBlock['items'][number],
): EditorChecklistBlock {
  return {
    ...block,
    items: block.items.map((item, index) => index === itemIndex ? updater(item) : item),
  }
}

export function QwenRichBlocks({
  session,
  disabled,
  onActivity,
  onCompositionStart,
  onCompositionEnd,
}: QwenRichBlocksProps) {
  const [blocks, setBlocks] = useState<EditorSurfaceBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void session.load()
      .then((loaded) => {
        if (!active) return
        setBlocks(loaded)
        setReady(true)
        setError('')
      })
      .catch(() => {
        if (!active) return
        setReady(false)
        setError('No se pudieron abrir los bloques de esta nota.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  function queueBlock(next: EditorSurfaceBlock, message: string) {
    setBlocks((current) => current.map((block) => block.id === next.id ? next : block))
    onActivity()
    void session.upsert(next).catch(() => setError(message))
  }

  function queueTextBlock(next: EditorSurfaceBlock) {
    // Text entry is intentionally left uncontrolled in React. The DOM owns the
    // active value while the in-memory block session receives the latest full
    // string. This avoids cloning/re-rendering the complete rich flow per key.
    onActivity()
    void session.upsert(next).catch(() => setError('No se pudo preparar el cambio del texto.'))
  }

  function removeBlock(blockId: string, message: string) {
    setBlocks((current) => current.filter((block) => block.id !== blockId))
    onActivity()
    void session.remove(blockId).catch(() => setError(message))
  }

  function insertBlock(kind: InsertBlockKind, index: number) {
    setActiveInsertIndex(null)

    let next: EditorSurfaceBlock
    if (kind === 'text') {
      next = encodeTextBlock({
        id: newTextBlockId(),
        kind: TEXT_BLOCK_KIND,
        text: '',
      })
    } else if (kind === 'checklist') {
      next = encodeChecklistBlock({
        id: newChecklistId(),
        kind: CHECKLIST_BLOCK_KIND,
        items: [{ text: '', checked: false }],
      })
    } else {
      next = encodeCodeBlock({
        id: newCodeBlockId(),
        kind: CODE_BLOCK_KIND,
        text: '',
        language: '',
      })
    }

    setBlocks((current) => [
      ...current.slice(0, index),
      next,
      ...current.slice(index),
    ])
    onActivity()

    void session.insert(next, index).catch(() => {
      setBlocks((current) => current.filter((block) => block.id !== next.id))
      const message = kind === 'text'
        ? 'No se pudo preparar el tramo de texto nuevo.'
        : kind === 'checklist'
          ? 'No se pudo preparar el checklist nuevo.'
          : 'No se pudo preparar el bloque de código nuevo.'
      setError(message)
    })
  }

  function renderText(block: EditorTextBlock) {
    return (
      <article className="oanix-qwen-sheet__text-block" data-oanix-text-segment={block.id}>
        <textarea
          defaultValue={block.text}
          maxLength={MAX_TEXT_BLOCK_TEXT_LENGTH}
          disabled={disabled}
          spellCheck
          wrap="soft"
          placeholder="Continúa escribiendo…"
          aria-label="Tramo de texto"
          onInput={(event) => queueTextBlock(encodeTextBlock({ ...block, text: event.currentTarget.value }))}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
        />
        <button
          type="button"
          className="oanix-qwen-sheet__text-remove"
          disabled={disabled}
          onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del tramo de texto.')}
          aria-label="Eliminar tramo de texto"
        >
          Eliminar tramo
        </button>
      </article>
    )
  }

  function renderChecklist(block: EditorChecklistBlock) {
    return (
      <article className="oanix-qwen-sheet__checklist">
        <div className="oanix-qwen-sheet__checklist-topline">
          <span>Checklist</span>
          <button type="button" className="oanix-qwen-sheet__checklist-remove" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del checklist.')} aria-label="Eliminar checklist">Eliminar</button>
        </div>
        <div className="oanix-qwen-sheet__checklist-items">
          {block.items.map((item, itemIndex) => (
            <div className="oanix-qwen-sheet__checklist-item" key={`${block.id}-${itemIndex}`}>
              <input type="checkbox" checked={item.checked} disabled={disabled} aria-label={`Marcar tarea ${itemIndex + 1}`} onChange={(event) => queueBlock(encodeChecklistBlock(withChecklistItem(block, itemIndex, (current) => ({ ...current, checked: event.target.checked }))), 'No se pudo preparar el cambio del checklist.')} />
              <input type="text" value={item.text} maxLength={2_000} disabled={disabled} placeholder="Escribe una tarea…" aria-label={`Tarea ${itemIndex + 1}`} onChange={(event) => queueBlock(encodeChecklistBlock(withChecklistItem(block, itemIndex, (current) => ({ ...current, text: event.target.value }))), 'No se pudo preparar el cambio del checklist.')} />
              <button type="button" className="oanix-qwen-sheet__checklist-item-remove" disabled={disabled} onClick={() => queueBlock(encodeChecklistBlock({ ...block, items: block.items.filter((_, index) => index !== itemIndex) }), 'No se pudo preparar el cambio del checklist.')} aria-label={`Eliminar tarea ${itemIndex + 1}`}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="oanix-qwen-sheet__checklist-add-item" disabled={disabled || block.items.length >= MAX_CHECKLIST_ITEMS} onClick={() => queueBlock(encodeChecklistBlock({ ...block, items: [...block.items, { text: '', checked: false }] }), 'No se pudo preparar el cambio del checklist.')}>+ Añadir tarea</button>
      </article>
    )
  }

  function renderCode(block: EditorCodeBlock) {
    return (
      <article className="oanix-qwen-sheet__code-block">
        <div className="oanix-qwen-sheet__code-topline">
          <input type="text" value={block.language} maxLength={MAX_CODE_BLOCK_LANGUAGE_LENGTH} disabled={disabled} placeholder="Lenguaje (opcional)" aria-label="Lenguaje del bloque de código" onChange={(event) => queueBlock(encodeCodeBlock({ ...block, language: event.target.value }), 'No se pudo preparar el cambio del bloque de código.')} />
          <button type="button" className="oanix-qwen-sheet__code-remove" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del bloque de código.')} aria-label="Eliminar bloque de código">Eliminar</button>
        </div>
        <textarea value={block.text} maxLength={MAX_CODE_BLOCK_TEXT_LENGTH} disabled={disabled} spellCheck={false} wrap="off" placeholder="Escribe o pega código…" aria-label="Contenido del bloque de código" onChange={(event) => queueBlock(encodeCodeBlock({ ...block, text: event.target.value }), 'No se pudo preparar el cambio del bloque de código.')} />
      </article>
    )
  }

  function renderBlock(rawBlock: EditorSurfaceBlock) {
    const text = decodeTextBlock(rawBlock)
    if (text) return renderText(text)

    const checklist = decodeChecklistBlock(rawBlock)
    if (checklist) return renderChecklist(checklist)

    const code = decodeCodeBlock(rawBlock)
    if (code) return renderCode(code)

    return (
      <article className="oanix-qwen-sheet__unknown-block" data-oanix-unknown-block-kind={rawBlock.kind}>
        <span>Bloque no disponible en esta versión</span>
      </article>
    )
  }

  function renderInsertPoint(index: number) {
    const menuId = `oanix-qwen-insert-menu-${index}`
    const open = activeInsertIndex === index

    return (
      <div className="oanix-qwen-sheet__insert-point" data-oanix-insert-index={index}>
        <button
          type="button"
          className="oanix-qwen-sheet__insert-trigger"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`Insertar bloque en la posición ${index + 1}`}
          disabled={disabled}
          onClick={() => setActiveInsertIndex((current) => current === index ? null : index)}
        >
          + Insertar
        </button>
        {open && (
          <div id={menuId} className="oanix-qwen-sheet__insert-menu" role="menu" aria-label="Insertar bloque">
            <button type="button" role="menuitem" onClick={() => insertBlock('text', index)}><strong>Texto</strong><span>Continúa escribiendo dentro del flujo</span></button>
            <button type="button" role="menuitem" onClick={() => insertBlock('checklist', index)}><strong>Checklist</strong><span>Lista de tareas verificable</span></button>
            <button type="button" role="menuitem" onClick={() => insertBlock('code', index)}><strong>Código</strong><span>Fragmento técnico con lenguaje opcional</span></button>
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="oanix-qwen-sheet__rich-content" aria-label="Bloques de la nota" data-oanix-flow-anchor="after-legacy-text">
      {loading && <p className="oanix-qwen-sheet__blocks-hint" role="status">Abriendo bloques cifrados…</p>}
      {error && <p className="oanix-qwen-sheet__blocks-error" role="alert">{error}</p>}

      {ready && (
        <div className="oanix-qwen-sheet__rich-flow" data-oanix-rich-block-flow="ordered">
          {renderInsertPoint(0)}
          {blocks.map((rawBlock, index) => (
            <Fragment key={rawBlock.id}>
              {renderBlock(rawBlock)}
              {renderInsertPoint(index + 1)}
            </Fragment>
          ))}
        </div>
      )}
    </section>
  )
}
