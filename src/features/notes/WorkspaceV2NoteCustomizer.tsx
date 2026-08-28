import { useState, type CSSProperties } from 'react'
import { OanixIcon } from '../../shared/OanixIcon'
import type { TagRecord } from '../tags/tagTypes'
import type { NoteListAppearanceInput } from './noteService'
import {
  DEFAULT_NOTE_VISUAL_COLOR,
  DEFAULT_NOTE_VISUAL_ICON,
  MAX_NOTE_VISUAL_DESCRIPTION_LENGTH,
  NOTE_VISUAL_COLORS,
  NOTE_VISUAL_ICONS,
  type NoteRecord,
  type NoteVisualIcon,
} from './noteTypes'

interface WorkspaceV2NoteCustomizerProps {
  note: NoteRecord
  tags: TagRecord[]
  onClose: () => void
  onSave: (noteId: string, input: NoteListAppearanceInput) => Promise<void>
}

export function WorkspaceV2NoteCustomizer({
  note,
  tags,
  onClose,
  onSave,
}: WorkspaceV2NoteCustomizerProps) {
  const [title, setTitle] = useState(note.title)
  const [description, setDescription] = useState(note.visualDescription ?? '')
  const [categoryTagId, setCategoryTagId] = useState(note.visualCategoryTagId ?? note.tagIds?.[0] ?? '')
  const [icon, setIcon] = useState<NoteVisualIcon>(note.visualIcon ?? DEFAULT_NOTE_VISUAL_ICON)
  const [color, setColor] = useState(note.visualColor ?? DEFAULT_NOTE_VISUAL_COLOR)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(note.id, {
        title,
        description,
        categoryTagId: categoryTagId || null,
        icon,
        color,
      })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la personalización.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="oanix-workspace-v2__modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="oanix-workspace-v2__modal oanix-workspace-v2__note-customizer"
        role="dialog"
        aria-modal="true"
        aria-label={`Personalizar ${note.title}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div><span>NOTA</span><strong>Editar tarjeta</strong></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar"><OanixIcon name="close" size={17} /></button>
        </header>

        <label className="oanix-workspace-v2__modal-field">
          <span>TÍTULO</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
          />
        </label>

        <label className="oanix-workspace-v2__modal-field">
          <span>DESCRIPCIÓN</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_NOTE_VISUAL_DESCRIPTION_LENGTH}
            rows={2}
            placeholder="Descripción breve para la tarjeta"
          />
          <small>{description.length}/{MAX_NOTE_VISUAL_DESCRIPTION_LENGTH}</small>
        </label>

        <label className="oanix-workspace-v2__modal-field">
          <span>CATEGORÍA</span>
          <select value={categoryTagId} onChange={(event) => setCategoryTagId(event.target.value)}>
            <option value="">Sin categoría</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </label>

        <fieldset className="oanix-workspace-v2__picker-section">
          <legend>ICONO</legend>
          <div className="oanix-workspace-v2__icon-picker">
            {NOTE_VISUAL_ICONS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === icon ? 'is-selected' : ''}
                aria-label={`Usar icono ${candidate}`}
                aria-pressed={candidate === icon}
                onClick={() => setIcon(candidate)}
                disabled={busy}
              >
                {candidate}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="oanix-workspace-v2__picker-section">
          <legend>COLOR DE TARJETA</legend>
          <div className="oanix-workspace-v2__color-picker">
            {NOTE_VISUAL_COLORS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === color ? 'is-selected' : ''}
                aria-label={`Usar color ${candidate}`}
                aria-pressed={candidate === color}
                style={{ '--v2-picker-color': candidate } as CSSProperties}
                onClick={() => setColor(candidate)}
                disabled={busy}
              />
            ))}
          </div>
        </fieldset>

        {error && <p className="oanix-workspace-v2__modal-error" role="alert">{error}</p>}

        <footer>
          <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="is-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </section>
    </div>
  )
}
