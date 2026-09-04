import { useMemo, useState } from 'react'
import {
  encodeContactBlock,
  MAX_CONTACT_FIELD_LENGTH,
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

  const initials = useMemo(() => {
    const parts = draft.name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '👤'
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  }, [draft.name])

  function commit(field: keyof ContactDraft, value: string) {
    if (!editing || disabled) return
    const next = { ...draft, [field]: value.slice(0, MAX_CONTACT_FIELD_LENGTH) }
    setDraft(next)
    onActivity()
    void Promise.resolve(onChange(encodeContactBlock({ ...block, ...next }))).catch(() => {
      onError?.('No se pudo preparar el cambio del contacto.')
    })
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

  return <article
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
        <input type="text" value={draft.name} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} readOnly={!editing} placeholder="Nombre del contacto" onChange={(event) => commit('name', event.currentTarget.value)} />
      </label>
      <label className="oanix-contact-block__field">
        <span>Teléfono</span>
        <input type="tel" value={draft.phone} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} readOnly={!editing} placeholder="+504…" onChange={(event) => commit('phone', event.currentTarget.value)} />
      </label>
      <label className="oanix-contact-block__field">
        <span>Correo</span>
        <input type="email" value={draft.email} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} readOnly={!editing} placeholder="nombre@correo.com" onChange={(event) => commit('email', event.currentTarget.value)} />
      </label>
      <label className="oanix-contact-block__field oanix-contact-block__field--wide">
        <span>Organización</span>
        <input type="text" value={draft.organization} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} readOnly={!editing} placeholder="Empresa u organización" onChange={(event) => commit('organization', event.currentTarget.value)} />
      </label>
      <label className="oanix-contact-block__field oanix-contact-block__field--wide">
        <span>Notas</span>
        <textarea value={draft.notes} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} readOnly={!editing} rows={3} placeholder="Notas privadas sobre este contacto…" onChange={(event) => commit('notes', event.currentTarget.value)} />
      </label>
    </div>

    {(draft.phone.trim() || draft.email.trim()) && <footer className="oanix-contact-block__actions">
      {draft.phone.trim() && <a href={`tel:${draft.phone.trim()}`} onClick={onActivity}>Llamar</a>}
      {draft.email.trim() && <a href={`mailto:${draft.email.trim()}`} onClick={onActivity}>Correo</a>}
    </footer>}
  </article>
}
