import { useEffect, useState } from 'react'
import {
  CHECKLIST_BLOCK_KIND,
  MAX_CHECKLIST_ITEMS,
  decodeChecklistBlock,
  encodeChecklistBlock,
  type EditorChecklistBlock,
} from '../checklistBlockCodec.ts'
import type { EditorBlockSession } from '../editorBlockSession.ts'

interface QwenChecklistBlocksProps {
  session: EditorBlockSession
  disabled: boolean
  onActivity: () => void
}

function newChecklistId(): string {
  return `checklist-${crypto.randomUUID()}`
}

function withItem(
  block: EditorChecklistBlock,
  itemIndex: number,
  updater: (item: EditorChecklistBlock['items'][number]) => EditorChecklistBlock['items'][number],
): EditorChecklistBlock {
  return {
    ...block,
    items: block.items.map((item, index) => index === itemIndex ? updater(item) : item),
  }
}

export function QwenChecklistBlocks({
  session,
  disabled,
  onActivity,
}: QwenChecklistBlocksProps) {
  const [blocks, setBlocks] = useState<EditorChecklistBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void session.load()
      .then((loaded) => {
        if (!active) return
        setBlocks(
          loaded.flatMap((block) => {
            const decoded = decodeChecklistBlock(block)
            return decoded ? [decoded] : []
          }),
        )
        setError('')
      })
      .catch(() => {
        if (active) setError('No se pudieron abrir los checklists de esta nota.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  function queueBlock(next: EditorChecklistBlock) {
    setBlocks((current) => current.map((block) => block.id === next.id ? next : block))
    onActivity()
    void session.upsert(encodeChecklistBlock(next)).catch(() => {
      setError('No se pudo preparar el cambio del checklist.')
    })
  }

  function addChecklist() {
    const next: EditorChecklistBlock = {
      id: newChecklistId(),
      kind: CHECKLIST_BLOCK_KIND,
      items: [{ text: '', checked: false }],
    }
    setBlocks((current) => [...current, next])
    onActivity()
    void session.upsert(encodeChecklistBlock(next)).catch(() => {
      setError('No se pudo preparar el checklist nuevo.')
    })
  }

  function removeChecklist(blockId: string) {
    setBlocks((current) => current.filter((block) => block.id !== blockId))
    onActivity()
    void session.remove(blockId).catch(() => {
      setError('No se pudo preparar la eliminación del checklist.')
    })
  }

  function addItem(block: EditorChecklistBlock) {
    if (block.items.length >= MAX_CHECKLIST_ITEMS) return
    queueBlock({
      ...block,
      items: [...block.items, { text: '', checked: false }],
    })
  }

  function removeItem(block: EditorChecklistBlock, itemIndex: number) {
    queueBlock({
      ...block,
      items: block.items.filter((_, index) => index !== itemIndex),
    })
  }

  return (
    <section className="oanix-qwen-sheet__checklists" aria-label="Checklists de la nota">
      <div className="oanix-qwen-sheet__blocks-heading">
        <div>
          <span className="oanix-qwen-sheet__blocks-kicker">Bloques</span>
          <strong>Checklist</strong>
        </div>
        <button
          type="button"
          className="oanix-qwen-sheet__add-checklist"
          disabled={disabled || loading}
          onClick={addChecklist}
        >
          + Checklist
        </button>
      </div>

      {loading && (
        <p className="oanix-qwen-sheet__blocks-hint" role="status">
          Abriendo bloques cifrados…
        </p>
      )}

      {error && (
        <p className="oanix-qwen-sheet__blocks-error" role="alert">
          {error}
        </p>
      )}

      {!loading && blocks.length === 0 && (
        <p className="oanix-qwen-sheet__blocks-hint">
          Añade tareas cuando necesites una lista verificable dentro de esta nota.
        </p>
      )}

      <div className="oanix-qwen-sheet__checklist-stack">
        {blocks.map((block) => (
          <article className="oanix-qwen-sheet__checklist" key={block.id}>
            <div className="oanix-qwen-sheet__checklist-topline">
              <span>Checklist</span>
              <button
                type="button"
                className="oanix-qwen-sheet__checklist-remove"
                disabled={disabled}
                onClick={() => removeChecklist(block.id)}
                aria-label="Eliminar checklist"
              >
                Eliminar
              </button>
            </div>

            <div className="oanix-qwen-sheet__checklist-items">
              {block.items.map((item, itemIndex) => (
                <div className="oanix-qwen-sheet__checklist-item" key={`${block.id}-${itemIndex}`}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    disabled={disabled}
                    aria-label={`Marcar tarea ${itemIndex + 1}`}
                    onChange={(event) => queueBlock(withItem(
                      block,
                      itemIndex,
                      (current) => ({ ...current, checked: event.target.checked }),
                    ))}
                  />
                  <input
                    type="text"
                    value={item.text}
                    maxLength={2_000}
                    disabled={disabled}
                    placeholder="Escribe una tarea…"
                    aria-label={`Tarea ${itemIndex + 1}`}
                    onChange={(event) => queueBlock(withItem(
                      block,
                      itemIndex,
                      (current) => ({ ...current, text: event.target.value }),
                    ))}
                  />
                  <button
                    type="button"
                    className="oanix-qwen-sheet__checklist-item-remove"
                    disabled={disabled}
                    onClick={() => removeItem(block, itemIndex)}
                    aria-label={`Eliminar tarea ${itemIndex + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="oanix-qwen-sheet__checklist-add-item"
              disabled={disabled || block.items.length >= MAX_CHECKLIST_ITEMS}
              onClick={() => addItem(block)}
            >
              + Añadir tarea
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
