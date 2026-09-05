import { useEffect, useState, type FormEvent } from 'react'
import {
  V2_FOLDER_GRADIENTS,
  V2_FOLDER_ICONS,
  type NoteV2Meta,
} from './rebuildModel'
import type { RebuildNoteCardCustomization } from './rebuildService'
import './noteCardCustomizationDialog.css'

interface NoteCardCustomizationDialogProps {
  note: NoteV2Meta | null
  busy?: boolean
  onClose: () => void
  onSave: (note: NoteV2Meta, input: RebuildNoteCardCustomization) => Promise<boolean>
}

export function NoteCardCustomizationDialog({
  note,
  busy = false,
  onClose,
  onSave,
}: NoteCardCustomizationDialogProps) {
  const [cardColor, setCardColor] = useState<string | null>(null)
  const [cardIcon, setCardIcon] = useState<string | null>(null)
  const [customIcon, setCustomIcon] = useState('')

  useEffect(() => {
    if (!note) return
    setCardColor(note.cardColor ?? null)
    setCardIcon(note.cardIcon ?? null)
    setCustomIcon(note.cardIcon && !V2_FOLDER_ICONS.includes(note.cardIcon as never) ? note.cardIcon : '')
  }, [note])

  if (!note) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!note || busy) return
    const ownIcon = customIcon.trim()
    const saved = await onSave(note, {
      cardColor,
      cardIcon: ownIcon || cardIcon,
    })
    if (saved) onClose()
  }

  return (
    <div className="rebuild-modal-host note-card-customization" role="presentation">
      <button
        className="rebuild-modal-backdrop"
        type="button"
        onClick={onClose}
        data-oanix-back-close="true"
        aria-label="Cerrar personalización de nota"
      />
      <section
        className="rebuild-modal note-card-customization__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Personalizar tarjeta de nota"
      >
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <small>NOTA</small>
              <strong>Personalizar tarjeta</strong>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar">×</button>
          </header>

          <p className="note-card-customization__hint">
            El color se aplica como un tinte suave para conservar visible el fondo de OANIX.
          </p>

          <fieldset className="note-card-customization__group">
            <legend>Icono</legend>
            <div className="note-card-customization__icons">
              <button
                type="button"
                className={cardIcon === null && customIcon === '' ? 'is-active' : ''}
                onClick={() => {
                  setCardIcon(null)
                  setCustomIcon('')
                }}
                aria-pressed={cardIcon === null && customIcon === ''}
                disabled={busy}
              >
                📝
              </button>
              {V2_FOLDER_ICONS.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={cardIcon === candidate && customIcon === '' ? 'is-active' : ''}
                  onClick={() => {
                    setCardIcon(candidate)
                    setCustomIcon('')
                  }}
                  aria-label={`Usar icono ${candidate}`}
                  aria-pressed={cardIcon === candidate && customIcon === ''}
                  disabled={busy}
                >
                  {candidate}
                </button>
              ))}
            </div>
            <label className="note-card-customization__own-icon">
              <span>Icono propio</span>
              <input
                value={customIcon}
                onChange={(event) => {
                  setCustomIcon(event.target.value.slice(0, 8))
                  if (event.target.value) setCardIcon(null)
                }}
                placeholder="Ej. 🧩"
                maxLength={8}
                disabled={busy}
                aria-label="Icono propio de la nota"
              />
            </label>
          </fieldset>

          <fieldset className="note-card-customization__group">
            <legend>Color suave</legend>
            <div className="note-card-customization__colors">
              <button
                type="button"
                className={`note-card-customization__no-color${cardColor === null ? ' is-active' : ''}`}
                onClick={() => setCardColor(null)}
                aria-label="Sin color personalizado"
                aria-pressed={cardColor === null}
                disabled={busy}
              >
                ∅
              </button>
              {V2_FOLDER_GRADIENTS.map(([from], index) => (
                <button
                  key={`${from}-${index}`}
                  type="button"
                  className={cardColor === from ? 'is-active' : ''}
                  style={{ background: from }}
                  onClick={() => setCardColor(from)}
                  aria-label={`Usar color ${index + 1}`}
                  aria-pressed={cardColor === from}
                  disabled={busy}
                />
              ))}
            </div>
            <label className="note-card-customization__color-input">
              <span>Color propio</span>
              <input
                type="color"
                value={cardColor ?? V2_FOLDER_GRADIENTS[0][0]}
                onChange={(event) => setCardColor(event.target.value)}
                disabled={busy}
              />
            </label>
          </fieldset>

          <footer>
            <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
