import { useState } from 'react'
import {
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_ITEM_TEXT_LENGTH,
  encodeChecklistBlock,
  type EditorChecklistBlock,
  type EditorChecklistItem,
} from '../checklistBlockCodec.ts'
import type { EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import './oanixChecklistBlockCard.css'

interface OanixChecklistBlockCardProps {
  block: EditorChecklistBlock
  disabled: boolean
  onChange: (block: EditorSurfaceBlock) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  onActivity: () => void
  onError?: (message: string) => void
}

export function OanixChecklistBlockCard({ block, disabled, onChange, onRemove, onActivity, onError }: OanixChecklistBlockCardProps) {
  const [items, setItems] = useState<EditorChecklistItem[]>(() => block.items.map((item) => ({ ...item })))

  function commit(next: EditorChecklistItem[]) {
    setItems(next)
    onActivity()
    void Promise.resolve(onChange(encodeChecklistBlock({ ...block, items: next }))).catch(() => {
      onError?.('No se pudo preparar el cambio de la checklist.')
    })
  }

  function updateItem(index: number, patch: Partial<EditorChecklistItem>) {
    commit(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  function addItem(afterIndex = items.length - 1) {
    if (disabled || items.length >= MAX_CHECKLIST_ITEMS) return
    const next = [...items]
    next.splice(Math.max(0, afterIndex + 1), 0, { text: '', checked: false })
    commit(next)
    window.requestAnimationFrame(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(`[data-oanix-checklist-id="${CSS.escape(block.id)}"] .oanix-checklist-block__text`)
      inputs[Math.min(afterIndex + 1, inputs.length - 1)]?.focus()
    })
  }

  function removeItem(index: number) {
    if (disabled) return
    commit(items.filter((_, itemIndex) => itemIndex !== index))
  }

  async function removeChecklist() {
    if (!onRemove || disabled) return
    if (!window.confirm('¿Eliminar esta checklist?')) return
    try {
      await onRemove()
    } catch {
      onError?.('No se pudo eliminar la checklist.')
    }
  }

  const completed = items.filter((item) => item.checked).length

  return <article
    className="oanix-checklist-block"
    data-oanix-element-id={block.id}
    data-oanix-element-kind="checklist"
    data-oanix-checklist-id={block.id}
  >
    <header className="oanix-checklist-block__header">
      <div><strong>Checklist</strong><small>{items.length === 0 ? 'Sin tareas' : `${completed}/${items.length} completadas`}</small></div>
      {onRemove && <button type="button" className="is-danger" disabled={disabled} onClick={() => void removeChecklist()}>Eliminar</button>}
    </header>

    <div className="oanix-checklist-block__items">
      {items.map((item, index) => <div className="oanix-checklist-block__row" key={index} data-checked={item.checked ? 'true' : 'false'}>
        <input
          className="oanix-checklist-block__check"
          type="checkbox"
          checked={item.checked}
          disabled={disabled}
          aria-label={`Marcar tarea ${index + 1}`}
          onChange={(event) => updateItem(index, { checked: event.currentTarget.checked })}
        />
        <input
          className="oanix-checklist-block__text"
          type="text"
          value={item.text}
          maxLength={MAX_CHECKLIST_ITEM_TEXT_LENGTH}
          disabled={disabled}
          placeholder="Nueva tarea…"
          aria-label={`Tarea ${index + 1}`}
          onChange={(event) => updateItem(index, { text: event.currentTarget.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addItem(index)
            }
          }}
        />
        <button type="button" className="oanix-checklist-block__remove-item" disabled={disabled} aria-label={`Quitar tarea ${index + 1}`} onClick={() => removeItem(index)}>×</button>
      </div>)}

      {items.length === 0 && <button type="button" className="oanix-checklist-block__empty" disabled={disabled} onClick={() => addItem(-1)}>＋ Añadir primera tarea</button>}
    </div>

    <footer>
      <button type="button" disabled={disabled || items.length >= MAX_CHECKLIST_ITEMS} onClick={() => addItem()}>＋ Añadir tarea</button>
      <small>{items.length}/{MAX_CHECKLIST_ITEMS}</small>
    </footer>
  </article>
}
