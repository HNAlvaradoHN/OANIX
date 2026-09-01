import { Fragment, useEffect, useRef, useState } from 'react'
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
import './qwenBlockOrderControls.css'

interface QwenRichBlocksProps {
  session: EditorBlockSession
  disabled: boolean
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
}

type InsertBlockKind = 'text' | 'checklist' | 'code'

function newTextBlockId(): string { return `text-${crypto.randomUUID()}` }
function newChecklistId(): string { return `checklist-${crypto.randomUUID()}` }
function newCodeBlockId(): string { return `code-${crypto.randomUUID()}` }

function withChecklistItem(block: EditorChecklistBlock, itemIndex: number, updater: (item: EditorChecklistBlock['items'][number]) => EditorChecklistBlock['items'][number]): EditorChecklistBlock {
  return { ...block, items: block.items.map((item, index) => index === itemIndex ? updater(item) : item) }
}

export function QwenRichBlocks({ session, disabled, onActivity, onCompositionStart, onCompositionEnd }: QwenRichBlocksProps) {
  const [blocks, setBlocks] = useState<EditorSurfaceBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)
  const pendingFocusIdRef = useRef<string | null>(null)
  const flowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    void session.load().then((loaded) => {
      if (!active) return
      setBlocks(loaded); setReady(true); setError('')
    }).catch(() => {
      if (!active) return
      setReady(false); setError('No se pudieron abrir los bloques de esta nota.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session])

  useEffect(() => {
    const blockId = pendingFocusIdRef.current
    if (!blockId || disabled) return
    const flow = flowRef.current
    const target = flow?.querySelector<HTMLElement>(`[data-oanix-block-id="${CSS.escape(blockId)}"] [data-oanix-primary-input="true"]`)
    if (!target) return
    pendingFocusIdRef.current = null
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'nearest' })
  }, [blocks, disabled])

  function queueBlock(next: EditorSurfaceBlock, message: string) {
    setBlocks((current) => current.map((block) => block.id === next.id ? next : block))
    onActivity()
    void session.upsert(next).catch(() => setError(message))
  }

  function queueTextBlock(next: EditorSurfaceBlock) {
    onActivity()
    void session.upsert(next).catch(() => setError('No se pudo preparar el cambio del texto.'))
  }

  function removeBlock(blockId: string, message: string) {
    setBlocks((current) => current.filter((block) => block.id !== blockId))
    onActivity()
    void session.remove(blockId).catch(() => setError(message))
  }

  function moveBlock(blockIndex: number, offset: -1 | 1) {
    const targetIndex = blockIndex + offset
    if (targetIndex < 0 || targetIndex >= blocks.length) return

    const next = [...blocks]
    const [moved] = next.splice(blockIndex, 1)
    next.splice(targetIndex, 0, moved)
    const nextOrder = next.map((block) => block.id)

    void session.reorder(nextOrder).then((changed) => {
      if (!changed) return
      setBlocks(next)
      setActiveInsertIndex(null)
      setError('')
      onActivity()
    }).catch(() => setError('No se pudo preparar el nuevo orden de los bloques.'))
  }

  function insertBlock(kind: InsertBlockKind, index: number) {
    setActiveInsertIndex(null)
    let next: EditorSurfaceBlock
    if (kind === 'text') next = encodeTextBlock({ id: newTextBlockId(), kind: TEXT_BLOCK_KIND, text: '' })
    else if (kind === 'checklist') next = encodeChecklistBlock({ id: newChecklistId(), kind: CHECKLIST_BLOCK_KIND, items: [{ text: '', checked: false }] })
    else next = encodeCodeBlock({ id: newCodeBlockId(), kind: CODE_BLOCK_KIND, text: '', language: '' })

    pendingFocusIdRef.current = next.id
    setBlocks((current) => [...current.slice(0, index), next, ...current.slice(index)])
    onActivity()
    void session.insert(next, index).catch(() => {
      if (pendingFocusIdRef.current === next.id) pendingFocusIdRef.current = null
      setBlocks((current) => current.filter((block) => block.id !== next.id))
      setError(kind === 'text' ? 'No se pudo preparar el tramo de texto nuevo.' : kind === 'checklist' ? 'No se pudo preparar el checklist nuevo.' : 'No se pudo preparar el bloque de código nuevo.')
    })
  }

  function renderText(block: EditorTextBlock) {
    return <article className="oanix-qwen-sheet__text-block" data-oanix-text-segment={block.id} data-oanix-block-id={block.id}>
      <textarea data-oanix-primary-input="true" defaultValue={block.text} maxLength={MAX_TEXT_BLOCK_TEXT_LENGTH} disabled={disabled} spellCheck wrap="soft" placeholder="Continúa escribiendo…" aria-label="Tramo de texto" onInput={(event) => queueTextBlock(encodeTextBlock({ ...block, text: event.currentTarget.value }))} onCompositionStart={onCompositionStart} onCompositionEnd={onCompositionEnd} />
      <button type="button" className="oanix-qwen-sheet__text-remove" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del tramo de texto.')} aria-label="Eliminar tramo de texto">Eliminar tramo</button>
    </article>
  }

  function renderChecklist(block: EditorChecklistBlock) {
    return <article className="oanix-qwen-sheet__checklist" data-oanix-block-id={block.id}>
      <div className="oanix-qwen-sheet__checklist-topline"><span>Checklist</span><button type="button" className="oanix-qwen-sheet__checklist-remove" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del checklist.')} aria-label="Eliminar checklist">Eliminar</button></div>
      <div className="oanix-qwen-sheet__checklist-items">{block.items.map((item, itemIndex) => <div className="oanix-qwen-sheet__checklist-item" key={`${block.id}-${itemIndex}`}>
        <input type="checkbox" checked={item.checked} disabled={disabled} aria-label={`Marcar tarea ${itemIndex + 1}`} onChange={(event) => queueBlock(encodeChecklistBlock(withChecklistItem(block, itemIndex, (current) => ({ ...current, checked: event.target.checked }))), 'No se pudo preparar el cambio del checklist.')} />
        <input data-oanix-primary-input={itemIndex === 0 ? 'true' : undefined} type="text" value={item.text} maxLength={2_000} disabled={disabled} placeholder="Escribe una tarea…" aria-label={`Tarea ${itemIndex + 1}`} onChange={(event) => queueBlock(encodeChecklistBlock(withChecklistItem(block, itemIndex, (current) => ({ ...current, text: event.target.value }))), 'No se pudo preparar el cambio del checklist.')} />
        <button type="button" className="oanix-qwen-sheet__checklist-item-remove" disabled={disabled} onClick={() => queueBlock(encodeChecklistBlock({ ...block, items: block.items.filter((_, index) => index !== itemIndex) }), 'No se pudo preparar el cambio del checklist.')} aria-label={`Eliminar tarea ${itemIndex + 1}`}>×</button>
      </div>)}</div>
      <button type="button" className="oanix-qwen-sheet__checklist-add-item" disabled={disabled || block.items.length >= MAX_CHECKLIST_ITEMS} onClick={() => queueBlock(encodeChecklistBlock({ ...block, items: [...block.items, { text: '', checked: false }] }), 'No se pudo preparar el cambio del checklist.')}>+ Añadir tarea</button>
    </article>
  }

  function renderCode(block: EditorCodeBlock) {
    return <article className="oanix-qwen-sheet__code-block" data-oanix-block-id={block.id}>
      <div className="oanix-qwen-sheet__code-topline"><input type="text" value={block.language} maxLength={MAX_CODE_BLOCK_LANGUAGE_LENGTH} disabled={disabled} placeholder="Lenguaje (opcional)" aria-label="Lenguaje del bloque de código" onChange={(event) => queueBlock(encodeCodeBlock({ ...block, language: event.target.value }), 'No se pudo preparar el cambio del bloque de código.')} /><button type="button" className="oanix-qwen-sheet__code-remove" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del bloque de código.')} aria-label="Eliminar bloque de código">Eliminar</button></div>
      <textarea data-oanix-primary-input="true" value={block.text} maxLength={MAX_CODE_BLOCK_TEXT_LENGTH} disabled={disabled} spellCheck={false} wrap="off" placeholder="Escribe o pega código…" aria-label="Contenido del bloque de código" onChange={(event) => queueBlock(encodeCodeBlock({ ...block, text: event.target.value }), 'No se pudo preparar el cambio del bloque de código.')} />
    </article>
  }

  function renderBlock(rawBlock: EditorSurfaceBlock) {
    const text = decodeTextBlock(rawBlock); if (text) return renderText(text)
    const checklist = decodeChecklistBlock(rawBlock); if (checklist) return renderChecklist(checklist)
    const code = decodeCodeBlock(rawBlock); if (code) return renderCode(code)
    return <article className="oanix-qwen-sheet__unknown-block" data-oanix-unknown-block-kind={rawBlock.kind}><span>Bloque no disponible en esta versión</span></article>
  }

  function renderOrderedBlock(rawBlock: EditorSurfaceBlock, index: number) {
    return <div className="oanix-qwen-sheet__block-shell" data-oanix-order-index={index}>
      <div className="oanix-qwen-sheet__block-order" role="group" aria-label={`Mover bloque ${index + 1}`}>
        <button type="button" disabled={disabled || index === 0} onClick={() => moveBlock(index, -1)} aria-label="Mover bloque arriba">↑</button>
        <button type="button" disabled={disabled || index === blocks.length - 1} onClick={() => moveBlock(index, 1)} aria-label="Mover bloque abajo">↓</button>
      </div>
      {renderBlock(rawBlock)}
    </div>
  }

  function renderInsertPoint(index: number) {
    const menuId = `oanix-qwen-insert-menu-${index}`
    const open = activeInsertIndex === index
    return <div className="oanix-qwen-sheet__insert-point" data-oanix-insert-index={index}>
      <button type="button" className="oanix-qwen-sheet__insert-trigger" aria-expanded={open} aria-controls={menuId} aria-label={`Insertar bloque en la posición ${index + 1}`} disabled={disabled} onClick={() => setActiveInsertIndex((current) => current === index ? null : index)}>+ Insertar</button>
      {open && <div id={menuId} className="oanix-qwen-sheet__insert-menu" role="menu" aria-label="Insertar bloque">
        <button type="button" role="menuitem" onClick={() => insertBlock('text', index)}><strong>Texto</strong><span>Continúa escribiendo dentro del flujo</span></button>
        <button type="button" role="menuitem" onClick={() => insertBlock('checklist', index)}><strong>Checklist</strong><span>Lista de tareas verificable</span></button>
        <button type="button" role="menuitem" onClick={() => insertBlock('code', index)}><strong>Código</strong><span>Fragmento técnico con lenguaje opcional</span></button>
      </div>}
    </div>
  }

  return <section className="oanix-qwen-sheet__rich-content" aria-label="Bloques de la nota" data-oanix-flow-anchor="after-legacy-text">
    {loading && <p className="oanix-qwen-sheet__blocks-hint" role="status">Abriendo bloques cifrados…</p>}
    {error && <p className="oanix-qwen-sheet__blocks-error" role="alert">{error}</p>}
    {ready && <div ref={flowRef} className="oanix-qwen-sheet__rich-flow" data-oanix-rich-block-flow="ordered">
      {renderInsertPoint(0)}
      {blocks.map((rawBlock, index) => <Fragment key={rawBlock.id}>{renderOrderedBlock(rawBlock, index)}{renderInsertPoint(index + 1)}</Fragment>)}
    </div>}
  </section>
}
