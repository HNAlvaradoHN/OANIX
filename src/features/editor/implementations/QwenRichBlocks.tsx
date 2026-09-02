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
import { decodeReplicaAttachmentFlowRef } from '../replicaAttachmentFlowCodec.ts'
import {
  replicaFlowIndexToOrderIndex,
  splitReplicaEditorBlocks,
} from '../replicaAttachmentFlowOrder.ts'
import {
  CONTACT_BLOCK_KIND,
  ENTRY_BLOCK_KIND,
  MAX_CONTACT_DETAIL_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_ENTRY_TEXT_LENGTH,
  MAX_ENTRY_TITLE_LENGTH,
  SEPARATOR_BLOCK_KIND,
  decodeContactBlock,
  decodeEntryBlock,
  decodeSeparatorBlock,
  encodeContactBlock,
  encodeEntryBlock,
  encodeSeparatorBlock,
  type EditorContactBlock,
  type EditorEntryBlock,
} from '../simpleRichBlockCodec.ts'
import {
  MAX_TEXT_BLOCK_TEXT_LENGTH,
  TEXT_BLOCK_KIND,
  decodeTextBlock,
  encodeTextBlock,
  type EditorTextBlock,
} from '../textBlockCodec.ts'
import type { EditorBlockSession } from '../editorBlockSession.ts'
import type { EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import {
  ReplicaV16AttachmentBlock,
  useReplicaV16AttachmentFlow,
} from './ReplicaV16Attachments.tsx'
import './qwenChecklistBlocks.css'
import './qwenCodeBlocks.css'
import './qwenTextBlocks.css'
import './qwenSimpleRichBlocks.css'
import './qwenBlockOrderControls.css'

export type QwenInsertBlockKind = 'text' | 'checklist' | 'code' | 'entry' | 'contact' | 'separator'
export type QwenExternalInsertKind = QwenInsertBlockKind | 'image' | 'file'

export interface QwenExternalInsertRequest {
  token: number
  kind: QwenExternalInsertKind
  index?: number
  legacySplit?: {
    before: string
    after: string
  }
}

interface QwenRichBlocksProps {
  session: EditorBlockSession
  disabled: boolean
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  externalInsertRequest?: QwenExternalInsertRequest | null
  continuousWriting?: boolean
  onInsertionIndexChange?: (index: number) => void
  onExternalInsertPrepared?: (token: number) => void
}

function newTextBlockId(): string { return `text-${crypto.randomUUID()}` }
function newChecklistId(): string { return `checklist-${crypto.randomUUID()}` }
function newCodeBlockId(): string { return `code-${crypto.randomUUID()}` }
function newEntryId(): string { return `entry-${crypto.randomUUID()}` }
function newContactId(): string { return `contact-${crypto.randomUUID()}` }
function newSeparatorId(): string { return `separator-${crypto.randomUUID()}` }

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

function insertionFailureMessage(kind: QwenInsertBlockKind): string {
  if (kind === 'text') return 'No se pudo preparar el tramo de texto nuevo.'
  if (kind === 'checklist') return 'No se pudo preparar el checklist nuevo.'
  if (kind === 'code') return 'No se pudo preparar el bloque de código nuevo.'
  if (kind === 'entry') return 'No se pudo preparar la entrada nueva.'
  if (kind === 'contact') return 'No se pudo preparar el contacto nuevo.'
  return 'No se pudo preparar el separador nuevo.'
}

export function QwenRichBlocks({
  session,
  disabled,
  onActivity,
  onCompositionStart,
  onCompositionEnd,
  externalInsertRequest = null,
  continuousWriting = false,
  onInsertionIndexChange,
  onExternalInsertPrepared,
}: QwenRichBlocksProps) {
  const [blocks, setBlocks] = useState<EditorSurfaceBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)
  const pendingFocusIdRef = useRef<string | null>(null)
  const consumedExternalInsertRef = useRef<number | null>(null)
  const flowRef = useRef<HTMLDivElement | null>(null)
  const attachmentFlow = useReplicaV16AttachmentFlow()
  const { flowBlocks: visibleBlocks, metadataBlocks: presentationBlocks } = splitReplicaEditorBlocks(blocks)
  const attachmentRevision = attachmentFlow?.revision ?? 0

  useEffect(() => {
    let active = true
    void session.load().then((loaded) => {
      if (!active) return
      setBlocks(loaded)
      setReady(true)
      setError('')
    }).catch(() => {
      if (!active) return
      setReady(false)
      setError('No se pudieron abrir los bloques de esta nota.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [session])

  useEffect(() => {
    if (!ready || attachmentRevision === 0) return
    let active = true
    void session.load().then((loaded) => {
      if (!active) return
      setBlocks(loaded)
      setError('')
    }).catch(() => {
      if (active) setError('No se pudo actualizar el orden de los adjuntos.')
    })
    return () => { active = false }
  }, [attachmentRevision, ready, session])

  useEffect(() => {
    const blockId = pendingFocusIdRef.current
    if (!blockId || disabled) return
    const flow = flowRef.current
    const target = flow?.querySelector<HTMLElement>(
      `[data-oanix-block-id="${CSS.escape(blockId)}"] [data-oanix-primary-input="true"]`,
    )
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
    if (targetIndex < 0 || targetIndex >= visibleBlocks.length) return

    const nextVisible = [...visibleBlocks]
    const [moved] = nextVisible.splice(blockIndex, 1)
    nextVisible.splice(targetIndex, 0, moved)
    const next = [...nextVisible, ...presentationBlocks]
    const nextOrder = next.map((block) => block.id)

    void session.reorder(nextOrder).then((changed) => {
      if (!changed) return
      setBlocks(next)
      setActiveInsertIndex(null)
      setError('')
      onActivity()
    }).catch(() => setError('No se pudo preparar el nuevo orden de los bloques.'))
  }

  function createBlock(kind: QwenInsertBlockKind): EditorSurfaceBlock {
    if (kind === 'text') return encodeTextBlock({ id: newTextBlockId(), kind: TEXT_BLOCK_KIND, text: '' })
    if (kind === 'checklist') {
      return encodeChecklistBlock({
        id: newChecklistId(),
        kind: CHECKLIST_BLOCK_KIND,
        items: [{ text: '', checked: false }],
      })
    }
    if (kind === 'code') {
      return encodeCodeBlock({ id: newCodeBlockId(), kind: CODE_BLOCK_KIND, text: '', language: '' })
    }
    if (kind === 'entry') {
      return encodeEntryBlock({
        id: newEntryId(),
        kind: ENTRY_BLOCK_KIND,
        title: '',
        text: '',
        createdAt: new Date().toISOString(),
      })
    }
    if (kind === 'contact') {
      return encodeContactBlock({
        id: newContactId(),
        kind: CONTACT_BLOCK_KIND,
        name: '',
        detail: '',
      })
    }
    return encodeSeparatorBlock({ id: newSeparatorId(), kind: SEPARATOR_BLOCK_KIND })
  }

  function createTextBlocks(text: string): EditorSurfaceBlock[] {
    const chunks: EditorSurfaceBlock[] = []
    for (let offset = 0; offset < text.length; offset += MAX_TEXT_BLOCK_TEXT_LENGTH) {
      chunks.push(encodeTextBlock({
        id: newTextBlockId(),
        kind: TEXT_BLOCK_KIND,
        text: text.slice(offset, offset + MAX_TEXT_BLOCK_TEXT_LENGTH),
      }))
    }
    return chunks
  }

  function insertPreparedBlock(nextBlock: EditorSurfaceBlock, index: number, kind: QwenInsertBlockKind) {
    setActiveInsertIndex(null)
    const boundedIndex = Math.min(Math.max(0, index), visibleBlocks.length)
    const rawIndex = replicaFlowIndexToOrderIndex(blocks, boundedIndex)
    const next = [
      ...visibleBlocks.slice(0, boundedIndex),
      nextBlock,
      ...visibleBlocks.slice(boundedIndex),
      ...presentationBlocks,
    ]

    if (kind !== 'separator') pendingFocusIdRef.current = nextBlock.id
    setBlocks(next)
    onActivity()
    onInsertionIndexChange?.(boundedIndex + 1)
    void session.insert(nextBlock, rawIndex).catch(() => {
      if (pendingFocusIdRef.current === nextBlock.id) pendingFocusIdRef.current = null
      setBlocks((current) => current.filter((block) => block.id !== nextBlock.id))
      setError(insertionFailureMessage(kind))
    })
  }

  function insertBlock(kind: QwenInsertBlockKind, index: number) {
    insertPreparedBlock(createBlock(kind), index, kind)
  }

  function insertWritingText(index: number, text: string) {
    const value = text.slice(0, MAX_TEXT_BLOCK_TEXT_LENGTH)
    if (!value) return
    const [nextBlock] = createTextBlocks(value)
    if (nextBlock) insertPreparedBlock(nextBlock, index, 'text')
  }

  function insertAttachment(kind: 'image' | 'file', index: number) {
    setActiveInsertIndex(null)
    onInsertionIndexChange?.(index + 1)
    attachmentFlow?.requestInsert(kind, index)
  }

  async function prepareLegacyCursorInsertion(request: QwenExternalInsertRequest, requestedIndex: number) {
    const split = request.legacySplit
    if (!split) return false

    const attachmentKind: 'image' | 'file' | null = request.kind === 'image' || request.kind === 'file'
      ? request.kind
      : null
    if (attachmentKind && !attachmentFlow?.enabled) {
      setError('Los adjuntos todavía no están disponibles en esta nota.')
      return true
    }

    const beforeBlocks = createTextBlocks(split.before)
    const afterBlocks = createTextBlocks(split.after)
    const targetBlock = attachmentKind ? null : createBlock(request.kind as QwenInsertBlockKind)
    const inserted: EditorSurfaceBlock[] = [
      ...beforeBlocks,
      ...(targetBlock ? [targetBlock] : []),
      ...afterBlocks,
    ]

    const rawIndex = replicaFlowIndexToOrderIndex(blocks, requestedIndex)
    try {
      for (let offset = 0; offset < inserted.length; offset += 1) {
        await session.insert(inserted[offset], rawIndex + offset)
      }

      if (inserted.length > 0) {
        setBlocks([
          ...visibleBlocks.slice(0, requestedIndex),
          ...inserted,
          ...visibleBlocks.slice(requestedIndex),
          ...presentationBlocks,
        ])
        onActivity()
      }

      onExternalInsertPrepared?.(request.token)

      const targetIndex = requestedIndex + beforeBlocks.length
      if (attachmentKind) {
        attachmentFlow?.requestInsert(attachmentKind, targetIndex)
        onInsertionIndexChange?.(targetIndex + 1)
        return true
      }

      if (targetBlock && request.kind !== 'separator') pendingFocusIdRef.current = targetBlock.id
      onInsertionIndexChange?.(targetIndex + 1)
      return true
    } catch {
      try {
        setBlocks(await session.load())
      } catch {
        // Keep the current render if even the recovery read fails.
      }
      setError('No se pudo preservar el texto alrededor de la inserción.')
      return true
    }
  }

  useEffect(() => {
    if (!ready || disabled || !externalInsertRequest) return
    if (consumedExternalInsertRef.current === externalInsertRequest.token) return
    consumedExternalInsertRef.current = externalInsertRequest.token
    const requestedIndex = Math.min(Math.max(0, externalInsertRequest.index ?? visibleBlocks.length), visibleBlocks.length)

    if (externalInsertRequest.legacySplit) {
      void prepareLegacyCursorInsertion(externalInsertRequest, requestedIndex)
      return
    }

    if (externalInsertRequest.kind === 'image' || externalInsertRequest.kind === 'file') {
      insertAttachment(externalInsertRequest.kind, requestedIndex)
      return
    }
    insertBlock(externalInsertRequest.kind, requestedIndex)
  }, [externalInsertRequest, ready, disabled, visibleBlocks.length])

  function renderText(block: EditorTextBlock) {
    return <article className="oanix-qwen-sheet__text-block" data-oanix-text-segment={block.id} data-oanix-block-id={block.id}>
      <textarea
        data-oanix-primary-input="true"
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
      >Eliminar tramo</button>
    </article>
  }

  function renderChecklist(block: EditorChecklistBlock) {
    return <article className="oanix-qwen-sheet__checklist" data-oanix-block-id={block.id}>
      <div className="oanix-qwen-sheet__checklist-topline">
        <span>Checklist</span>
        <button type="button" className="oanix-qwen-sheet__checklist-remove" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del checklist.')} aria-label="Eliminar checklist">Eliminar</button>
      </div>
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
      <div className="oanix-qwen-sheet__code-topline">
        <input type="text" value={block.language} maxLength={MAX_CODE_BLOCK_LANGUAGE_LENGTH} disabled={disabled} placeholder="Lenguaje (opcional)" aria-label="Lenguaje del bloque de código" onChange={(event) => queueBlock(encodeCodeBlock({ ...block, language: event.target.value }), 'No se pudo preparar el cambio del bloque de código.')} />
        <button type="button" className="oanix-qwen-sheet__code-remove" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del bloque de código.')} aria-label="Eliminar bloque de código">Eliminar</button>
      </div>
      <textarea data-oanix-primary-input="true" value={block.text} maxLength={MAX_CODE_BLOCK_TEXT_LENGTH} disabled={disabled} spellCheck={false} wrap="off" placeholder="Escribe o pega código…" aria-label="Contenido del bloque de código" onChange={(event) => queueBlock(encodeCodeBlock({ ...block, text: event.target.value }), 'No se pudo preparar el cambio del bloque de código.')} />
    </article>
  }

  function renderEntry(block: EditorEntryBlock) {
    const dateLabel = Number.isNaN(Date.parse(block.createdAt))
      ? ''
      : new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(block.createdAt))
    return <article className="oanix-qwen-sheet__entry" data-oanix-block-id={block.id}>
      <div className="oanix-qwen-sheet__simple-topline">
        <span>Entrada{dateLabel ? ` · ${dateLabel}` : ''}</span>
        <button type="button" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación de la entrada.')}>Eliminar</button>
      </div>
      <input data-oanix-primary-input="true" type="text" value={block.title} maxLength={MAX_ENTRY_TITLE_LENGTH} disabled={disabled} placeholder="Título de la entrada" aria-label="Título de la entrada" onChange={(event) => queueBlock(encodeEntryBlock({ ...block, title: event.target.value }), 'No se pudo preparar el cambio de la entrada.')} />
      <textarea value={block.text} maxLength={MAX_ENTRY_TEXT_LENGTH} disabled={disabled} spellCheck wrap="soft" placeholder="Escribe la entrada…" aria-label="Contenido de la entrada" onChange={(event) => queueBlock(encodeEntryBlock({ ...block, text: event.target.value }), 'No se pudo preparar el cambio de la entrada.')} onCompositionStart={onCompositionStart} onCompositionEnd={onCompositionEnd} />
    </article>
  }

  function renderContact(block: EditorContactBlock) {
    return <article className="oanix-qwen-sheet__contact" data-oanix-block-id={block.id}>
      <div className="oanix-qwen-sheet__simple-topline">
        <span>Contacto</span>
        <button type="button" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del contacto.')}>Eliminar</button>
      </div>
      <div className="oanix-qwen-sheet__contact-grid">
        <span className="oanix-qwen-sheet__contact-avatar" aria-hidden="true">👤</span>
        <div>
          <input data-oanix-primary-input="true" type="text" value={block.name} maxLength={MAX_CONTACT_NAME_LENGTH} disabled={disabled} placeholder="Nombre" aria-label="Nombre del contacto" onChange={(event) => queueBlock(encodeContactBlock({ ...block, name: event.target.value }), 'No se pudo preparar el cambio del contacto.')} />
          <input type="text" value={block.detail} maxLength={MAX_CONTACT_DETAIL_LENGTH} disabled={disabled} placeholder="Teléfono, correo o nota" aria-label="Detalle del contacto" onChange={(event) => queueBlock(encodeContactBlock({ ...block, detail: event.target.value }), 'No se pudo preparar el cambio del contacto.')} />
        </div>
      </div>
    </article>
  }

  function renderSeparator(rawBlock: EditorSurfaceBlock) {
    return <article className="oanix-qwen-sheet__separator" data-oanix-block-id={rawBlock.id}>
      <hr />
      <button type="button" disabled={disabled} onClick={() => removeBlock(rawBlock.id, 'No se pudo preparar la eliminación del separador.')} aria-label="Eliminar separador">Eliminar</button>
    </article>
  }

  function renderBlock(rawBlock: EditorSurfaceBlock) {
    const text = decodeTextBlock(rawBlock); if (text) return renderText(text)
    const checklist = decodeChecklistBlock(rawBlock); if (checklist) return renderChecklist(checklist)
    const code = decodeCodeBlock(rawBlock); if (code) return renderCode(code)
    const entry = decodeEntryBlock(rawBlock); if (entry) return renderEntry(entry)
    const contact = decodeContactBlock(rawBlock); if (contact) return renderContact(contact)
    const separator = decodeSeparatorBlock(rawBlock); if (separator) return renderSeparator(rawBlock)
    const attachmentRef = decodeReplicaAttachmentFlowRef(rawBlock)
    if (attachmentRef) return <ReplicaV16AttachmentBlock flowRef={attachmentRef} disabled={disabled} />
    return <article className="oanix-qwen-sheet__unknown-block" data-oanix-unknown-block-kind={rawBlock.kind}><span>Bloque no disponible en esta versión</span></article>
  }

  function renderOrderedBlock(rawBlock: EditorSurfaceBlock, index: number) {
    return <div
      className="oanix-qwen-sheet__block-shell"
      data-oanix-order-index={index}
      onFocusCapture={() => onInsertionIndexChange?.(index + 1)}
    >
      <div className="oanix-qwen-sheet__block-order" role="group" aria-label={`Mover bloque ${index + 1}`}>
        <button type="button" disabled={disabled || index === 0} onClick={() => moveBlock(index, -1)} aria-label="Mover bloque arriba">↑</button>
        <button type="button" disabled={disabled || index === visibleBlocks.length - 1} onClick={() => moveBlock(index, 1)} aria-label="Mover bloque abajo">↓</button>
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
        <button type="button" role="menuitem" onClick={() => insertBlock('entry', index)}><strong>Entrada</strong><span>Registro fechado dentro de la nota</span></button>
        {attachmentFlow?.enabled && <button type="button" role="menuitem" onClick={() => insertAttachment('image', index)}><strong>Imagen</strong><span>Asset cifrado en esta posición</span></button>}
        {attachmentFlow?.enabled && <button type="button" role="menuitem" onClick={() => insertAttachment('file', index)}><strong>Archivo</strong><span>Adjunto cifrado en esta posición</span></button>}
        <button type="button" role="menuitem" onClick={() => insertBlock('checklist', index)}><strong>Checklist</strong><span>Lista de tareas verificable</span></button>
        <button type="button" role="menuitem" onClick={() => insertBlock('contact', index)}><strong>Contacto</strong><span>Nombre y dato de referencia</span></button>
        <button type="button" role="menuitem" onClick={() => insertBlock('separator', index)}><strong>Separador</strong><span>Línea de división</span></button>
        <button type="button" role="menuitem" onClick={() => insertBlock('code', index)}><strong>Código</strong><span>Fragmento técnico con lenguaje opcional</span></button>
      </div>}
    </div>
  }

  function renderWritingSeam(index: number) {
    return <div className="oanix-continuous-seam" data-oanix-insert-index={index}>
      <input
        type="text"
        value=""
        disabled={disabled}
        aria-label={`Escribir en la posición ${index + 1}`}
        placeholder="Escribe aquí…"
        onFocus={() => onInsertionIndexChange?.(index)}
        onChange={(event) => insertWritingText(index, event.currentTarget.value)}
      />
    </div>
  }

  return <section className="oanix-qwen-sheet__rich-content" aria-label="Bloques de la nota" data-oanix-flow-anchor="after-legacy-text">
    {loading && <p className="oanix-qwen-sheet__blocks-hint" role="status">Abriendo bloques cifrados…</p>}
    {error && <p className="oanix-qwen-sheet__blocks-error" role="alert">{error}</p>}
    {ready && <div ref={flowRef} className="oanix-qwen-sheet__rich-flow" data-oanix-rich-block-flow="ordered">
      {continuousWriting ? renderWritingSeam(0) : renderInsertPoint(0)}
      {visibleBlocks.map((rawBlock, index) => <Fragment key={rawBlock.id}>{renderOrderedBlock(rawBlock, index)}{continuousWriting ? renderWritingSeam(index + 1) : renderInsertPoint(index + 1)}</Fragment>)}
    </div>}
  </section>
}
