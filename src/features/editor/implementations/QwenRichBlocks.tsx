import { useEffect, useState } from 'react'
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
import type { EditorBlockSession } from '../editorBlockSession.ts'
import type { EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import './qwenChecklistBlocks.css'
import './qwenCodeBlocks.css'

interface QwenRichBlocksProps {
  session: EditorBlockSession
  disabled: boolean
  onActivity: () => void
}

type InsertBlockKind = 'checklist' | 'code'

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

export function QwenRichBlocks({ session, disabled, onActivity }: QwenRichBlocksProps) {
  const [blocks, setBlocks] = useState<EditorSurfaceBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [insertMenuOpen, setInsertMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    void session.load()
      .then((loaded) => {
        if (!active) return
        setBlocks(loaded)
        setError('')
      })
      .catch(() => {
        if (active) setError('No se pudieron abrir los bloques de esta nota.')
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

  function appendBlock(next: EditorSurfaceBlock, message: string) {
    setBlocks((current) => [...current, next])
    onActivity()
    void session.upsert(next).catch(() => setError(message))
  }

  function removeBlock(blockId: string, message: string) {
    setBlocks((current) => current.filter((block) => block.id !== blockId))
    onActivity()
    void session.remove(blockId).catch(() => setError(message))
  }

  function insertBlock(kind: InsertBlockKind) {
    setInsertMenuOpen(false)
    if (kind === 'checklist') {
      appendBlock(encodeChecklistBlock({
        id: newChecklistId(),
        kind: CHECKLIST_BLOCK_KIND,
        items: [{ text: '', checked: false }],
      }), 'No se pudo preparar el checklist nuevo.')
      return
    }

    appendBlock(encodeCodeBlock({
      id: newCodeBlockId(),
      kind: CODE_BLOCK_KIND,
      text: '',
      language: '',
    }), 'No se pudo preparar el bloque de código nuevo.')
  }

  function renderChecklist(block: EditorChecklistBlock) {
    return (
      <article className="oanix-qwen-sheet__checklist" key={block.id}>
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
      <article className="oanix-qwen-sheet__code-block" key={block.id}>
        <div className="oanix-qwen-sheet__code-topline">
          <input type="text" value={block.language} maxLength={MAX_CODE_BLOCK_LANGUAGE_LENGTH} disabled={disabled} placeholder="Lenguaje (opcional)" aria-label="Lenguaje del bloque de código" onChange={(event) => queueBlock(encodeCodeBlock({ ...block, language: event.target.value }), 'No se pudo preparar el cambio del bloque de código.')} />
          <button type="button" className="oanix-qwen-sheet__code-remove" disabled={disabled} onClick={() => removeBlock(block.id, 'No se pudo preparar la eliminación del bloque de código.')} aria-label="Eliminar bloque de código">Eliminar</button>
        </div>
        <textarea value={block.text} maxLength={MAX_CODE_BLOCK_TEXT_LENGTH} disabled={disabled} spellCheck={false} wrap="off" placeholder="Escribe o pega código…" aria-label="Contenido del bloque de código" onChange={(event) => queueBlock(encodeCodeBlock({ ...block, text: event.target.value }), 'No se pudo preparar el cambio del bloque de código.')} />
      </article>
    )
  }

  return (
    <section className="oanix-qwen-sheet__rich-content" aria-label="Bloques de la nota">
      <div className="oanix-qwen-sheet__insert">
        <button type="button" className="oanix-qwen-sheet__insert-trigger" aria-expanded={insertMenuOpen} aria-controls="oanix-qwen-insert-menu" disabled={disabled || loading} onClick={() => setInsertMenuOpen((open) => !open)}>+ Insertar</button>
        {insertMenuOpen && (
          <div id="oanix-qwen-insert-menu" className="oanix-qwen-sheet__insert-menu" role="menu" aria-label="Insertar bloque">
            <button type="button" role="menuitem" onClick={() => insertBlock('checklist')}><strong>Checklist</strong><span>Lista de tareas verificable</span></button>
            <button type="button" role="menuitem" onClick={() => insertBlock('code')}><strong>Código</strong><span>Fragmento técnico con lenguaje opcional</span></button>
          </div>
        )}
      </div>

      {loading && <p className="oanix-qwen-sheet__blocks-hint" role="status">Abriendo bloques cifrados…</p>}
      {error && <p className="oanix-qwen-sheet__blocks-error" role="alert">{error}</p>}

      <div className="oanix-qwen-sheet__checklist-stack" data-oanix-rich-block-flow="ordered">
        {blocks.map((rawBlock) => {
          const checklist = decodeChecklistBlock(rawBlock)
          if (checklist) return renderChecklist(checklist)
          const code = decodeCodeBlock(rawBlock)
          if (code) return renderCode(code)
          return null
        })}
      </div>
    </section>
  )
}
