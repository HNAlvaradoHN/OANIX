import { useEffect, useMemo, useState } from 'react'
import {
  encodeContactBlock,
  isValidContactEmail,
  MAX_CONTACT_EMAIL_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_CONTACT_NOTES_LENGTH,
  MAX_CONTACT_ORGANIZATION_LENGTH,
  MAX_CONTACT_PHONE_LENGTH,
  sanitizeContactPhone,
  type EditorContactBlock,
} from '../contactBlockCodec.ts'
import type { EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import './oanixContactBlockCard.css'

interface OanixContactBlockCardProps {
  block: EditorContactBlock
  disabled: boolean
  onChange: (block: EditorSurfaceBlock) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  onActivity: () => void
  onError?: (message: string) => void
}

type ContactDraft = Omit<EditorContactBlock, 'id' | 'kind'>

export function OanixContactBlockCard({ block, disabled, onChange, onRemove, onActivity, onError }: OanixContactBlockCardProps) {
  const [draft, setDraft] = useState<ContactDraft>(() => ({
    name: block.name,
    phone: block.phone,
    email: block.email,
    organization: block.organization,
    notes: block.notes,
  }))
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [emailRejected, setEmailRejected] = useState(false)

  const initials = useMemo(() => {
    const parts = draft.name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '👤'
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  }, [draft.name])

  useEffect(() => {
    if (!notesExpanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotesExpanded(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [notesExpanded])

  function persist(next: ContactDraft) {
    setDraft(next)
    onActivity()
    void Promise.resolve(onChange(encodeContactBlock({ ...block, ...next }))).catch(() => {
      onError?.('No se pudo preparar el cambio del contacto.')
    })
  }

  function commit(field: keyof ContactDraft, value: string, maxLength: number) {
    if (!editing || disabled) return
    persist({ ...draft, [field]: value.slice(0, maxLength) })
  }

  function handlePhoneChange(value: string) {
    if (!editing || disabled) return
    commit('phone', sanitizeContactPhone(value), MAX_CONTACT_PHONE_LENGTH)
  }

  function handleEmailChange(value: string) {
    if (!editing || disabled) return
    const nextEmail = value.slice(0, MAX_CONTACT_EMAIL_LENGTH)
    const next = { ...draft, email: nextEmail }
    setDraft(next)
    setEmailRejected(false)
    onActivity()
    if (!isValidContactEmail(nextEmail)) return
    void Promise.resolve(onChange(encodeContactBlock({ ...block, ...next }))).catch(() => {
      onError?.('No se pudo preparar el cambio del contacto.')
    })
  }

  function handleEmailBlur() {
    if (!editing || disabled || isValidContactEmail(draft.email)) return
    setEmailRejected(true)
    persist({ ...draft, email: '' })
  }

  function setEditMode(nextEditing: boolean) {
    if (disabled) return
    setEditing(nextEditing)
    setMenuOpen(false)
    onActivity()
  }

  async function removeContact() {
    if (!onRemove || disabled) return
    setMenuOpen(false)
    if (!window.confirm('¿Eliminar esta tarjeta de contacto?')) return
    try {
      await onRemove()
    } catch {
      onError?.('No se pudo eliminar el contacto.')
    }
  }

  return <>
    <article
      className="oanix-contact-block"
      data-oanix-element-id={block.id}
      data-oanix-element-kind="contact"
      data-editing={editing ? 'true' : 'false'}
    >
      <header className="oanix-contact-block__header">
        <span className="oanix-contact-block__avatar" aria-hidden="true">{initials}</span>
        <div className="oanix-contact-block__heading">
          <strong>{draft.name.trim() || 'Contacto'}</strong>
          <small>{editing ? 'Edición desbloqueada' : (draft.organization.trim() || 'Tarjeta privada')}</small>
        </div>
        <div className="oanix-contact-block__menu-wrap">
          <button
            type="button"
            className="oanix-contact-block__menu-button"
            disabled={disabled}
            aria-label={editing ? 'Contacto desbloqueado; abrir menú' : 'Contacto bloqueado; abrir menú'}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={editing ? 'Edición desbloqueada' : 'Edición bloqueada'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">{editing ? '🔓' : '🔒'}</span>
            <span aria-hidden="true">⋮</span>
          </button>
          {menuOpen && <div className="oanix-contact-block__menu" role="menu" aria-label="Opciones del contacto">
            <button type="button" role="menuitem" onClick={() => setEditMode(!editing)}>
              <span aria-hidden="true">{editing ? '🔒' : '🔓'}</span>
              <span>{editing ? 'Bloquear edición' : 'Editar contacto'}</span>
            </button>
            {onRemove && <button type="button" role="menuitem" className="is-danger" onClick={() => void removeContact()}>
              <span aria-hidden="true">⌫</span><span>Eliminar contacto</span>
            </button>}
          </div>}
        </div>
      </header>

      <div className="oanix-contact-block__grid">
        <label className="oanix-contact-block__field oanix-contact-block__field--wide">
          <span>Nombre</span>
          <input type="text" value={draft.name} maxLength={MAX_CONTACT_NAME_LENGTH} disabled={disabled} readOnly={!editing} placeholder="Nombre del contacto" onChange={(event) => commit('name', event.currentTarget.value, MAX_CONTACT_NAME_LENGTH)} />
        </label>
        <label className="oanix-contact-block__field">
          <span>Teléfono</span>
          <input type="tel" inputMode="numeric" pattern="[0-9]*" value={draft.phone} maxLength={MAX_CONTACT_PHONE_LENGTH} disabled={disabled} readOnly={!editing} placeholder="Número de teléfono" onChange={(event) => handlePhoneChange(event.currentTarget.value)} />
        </label>
        <label className="oanix-contact-block__field">
          <span>Correo</span>
          <input type="email" inputMode="email" value={draft.email} maxLength={MAX_CONTACT_EMAIL_LENGTH} disabled={disabled} readOnly={!editing} aria-invalid={emailRejected || undefined} placeholder="nombre@correo.com" onChange={(event) => handleEmailChange(event.currentTarget.value)} onBlur={handleEmailBlur} />
          {emailRejected && <small className="oanix-contact-block__validation">Correo no válido; no se guardó.</small>}
        </label>
        <label className="oanix-contact-block__field oanix-contact-block__field--wide">
          <span>Organización</span>
          <input type="text" value={draft.organization} maxLength={MAX_CONTACT_ORGANIZATION_LENGTH} disabled={disabled} readOnly={!editing} placeholder="Empresa u organización" onChange={(event) => commit('organization', event.currentTarget.value, MAX_CONTACT_ORGANIZATION_LENGTH)} />
        </label>
        <label className="oanix-contact-block__field oanix-contact-block__field--wide">
          <span className="oanix-contact-block__field-heading">
            <span>Notas</span>
            <button
              type="button"
              className="oanix-contact-block__notes-expand-button"
              onClick={() => setNotesExpanded(true)}
              aria-label="Abrir notas en pantalla completa"
              title="Abrir notas"
            >⛶</button>
          </span>
          <textarea value={draft.notes} maxLength={MAX_CONTACT_NOTES_LENGTH} disabled={disabled} readOnly={!editing} rows={3} placeholder="Notas privadas sobre este contacto…" onChange={(event) => commit('notes', event.currentTarget.value, MAX_CONTACT_NOTES_LENGTH)} />
        </label>
      </div>

      {(draft.phone.trim() || (draft.email.trim() && isValidContactEmail(draft.email))) && <footer className="oanix-contact-block__actions">
        {draft.phone.trim() && <a href={`tel:${draft.phone.trim()}`} onClick={onActivity}>Llamar</a>}
        {draft.email.trim() && isValidContactEmail(draft.email) && <a href={`mailto:${draft.email.trim()}`} onClick={onActivity}>Correo</a>}
      </footer>}
    </article>

    {notesExpanded && <div
      className="oanix-contact-block__fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label="Notas del contacto en pantalla completa"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setNotesExpanded(false)
      }}
    >
      <section className="oanix-contact-block__fullscreen-panel oanix-contact-block__fullscreen-panel--notes">
        <header className="oanix-contact-block__fullscreen-header">
          <div className="oanix-contact-block__fullscreen-title">
            <span className="oanix-contact-block__avatar" aria-hidden="true">{initials}</span>
            <div>
              <strong>Notas</strong>
              <small>{draft.name.trim() || 'Contacto'}</small>
            </div>
          </div>
          <button type="button" onClick={() => setNotesExpanded(false)} aria-label="Cerrar notas en pantalla completa">✕</button>
        </header>
        <div className="oanix-contact-block__fullscreen-notes">
          <textarea
            value={draft.notes}
            maxLength={MAX_CONTACT_NOTES_LENGTH}
            disabled={disabled}
            readOnly={!editing}
            aria-label="Notas del contacto"
            placeholder="Notas privadas sobre este contacto…"
            onChange={(event) => commit('notes', event.currentTarget.value, MAX_CONTACT_NOTES_LENGTH)}
          />
          {!editing && <small>Desbloquee la edición del contacto para modificar las notas.</small>}
        </div>
      </section>
    </div>}
  </>
}
