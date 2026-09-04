import { useRef, useState } from 'react'
import {
  encodeDailyEntryBlock,
  formatDailyEntryDate,
  isValidDailyEntryDate,
  MAX_DAILY_ENTRY_TEXT_LENGTH,
  MAX_DAILY_ENTRY_TITLE_LENGTH,
  type EditorDailyEntryBlock,
} from '../dailyEntryBlockCodec.ts'
import type { EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import './oanixDailyEntryBlockCard.css'

interface OanixDailyEntryBlockCardProps {
  block: EditorDailyEntryBlock
  disabled: boolean
  onChange: (block: EditorSurfaceBlock) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onError?: (message: string) => void
}

function CalendarIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
}

export function OanixDailyEntryBlockCard({
  block,
  disabled,
  onChange,
  onRemove,
  onActivity,
  onCompositionStart,
  onCompositionEnd,
  onError,
}: OanixDailyEntryBlockCardProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const [removing, setRemoving] = useState(false)

  function persist(next: EditorDailyEntryBlock) {
    onActivity()
    void Promise.resolve(onChange(encodeDailyEntryBlock(next))).catch(() => {
      onError?.('No se pudo preparar el cambio de la entrada.')
    })
  }

  function openDatePicker() {
    if (disabled) return
    const input = dateInputRef.current
    if (!input) return
    const picker = input as HTMLInputElement & { showPicker?: () => void }
    try {
      if (picker.showPicker) picker.showPicker()
      else {
        input.focus({ preventScroll: true })
        input.click()
      }
    } catch {
      input.focus({ preventScroll: true })
    }
  }

  function updateDate(value: string) {
    if (!isValidDailyEntryDate(value) || value === block.date) return
    persist({ ...block, date: value })
  }

  async function removeEntry() {
    if (!onRemove || disabled || removing) return
    if (!window.confirm('¿Eliminar esta entrada?')) return
    setRemoving(true)
    try {
      await onRemove()
    } catch {
      setRemoving(false)
      onError?.('No se pudo eliminar la entrada.')
    }
  }

  return <article
    className="oanix-daily-entry"
    data-oanix-element-id={block.id}
    data-oanix-element-kind="dailyEntry"
    data-editor-atomic-block="true"
  >
    <div className="oanix-daily-entry__date-row">
      <span className="oanix-daily-entry__line" aria-hidden="true"/>
      <div className="oanix-daily-entry__date-control">
        <button type="button" className="oanix-daily-entry__calendar" disabled={disabled} onClick={openDatePicker} aria-label="Cambiar fecha de la entrada" title="Cambiar fecha">
          <CalendarIcon/>
        </button>
        <button type="button" className="oanix-daily-entry__date-label" disabled={disabled} onClick={openDatePicker} aria-label={`Cambiar fecha: ${formatDailyEntryDate(block.date)}`}>
          {formatDailyEntryDate(block.date)}
        </button>
        <input
          ref={dateInputRef}
          className="oanix-daily-entry__date-input"
          type="date"
          value={block.date}
          min="0001-01-01"
          max="9999-12-31"
          tabIndex={-1}
          aria-label="Fecha de la entrada"
          disabled={disabled}
          onChange={(event) => updateDate(event.currentTarget.value)}
        />
      </div>
      <span className="oanix-daily-entry__line" aria-hidden="true"/>
      {onRemove && <button type="button" className="oanix-daily-entry__remove" disabled={disabled || removing} onClick={() => void removeEntry()} aria-label="Eliminar entrada" title="Eliminar entrada">×</button>}
    </div>

    <input
      className="oanix-daily-entry__title"
      data-editor-local-editable="true"
      type="text"
      value={block.title}
      maxLength={MAX_DAILY_ENTRY_TITLE_LENGTH}
      disabled={disabled}
      placeholder="Título (opcional)"
      autoComplete="off"
      autoCapitalize="sentences"
      spellCheck
      onChange={(event) => persist({ ...block, title: event.currentTarget.value })}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
      aria-label="Título de la entrada"
    />

    <textarea
      className="oanix-daily-entry__text"
      data-editor-local-editable="true"
      value={block.text}
      maxLength={MAX_DAILY_ENTRY_TEXT_LENGTH}
      disabled={disabled}
      rows={4}
      placeholder="Escribe esta entrada…"
      autoCapitalize="sentences"
      spellCheck
      onChange={(event) => persist({ ...block, text: event.currentTarget.value })}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
      aria-label="Contenido de la entrada"
    />
  </article>
}
