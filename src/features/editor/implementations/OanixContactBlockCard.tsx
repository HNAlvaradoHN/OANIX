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

  const initials = useMemo(() => {
    const parts = draft.name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '👤'
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  }, [draft.name])

  function commit(field: keyof ContactDraft, value: string) {
    const next = { ...draft, [field]: value.slice(0, MAX_CONTACT_FIELD_LENGTH) }
    setDraft(next)
    onActivity()
    void Promise.resolve(onChange(encodeContactBlock({ ...block, ...next }))).catch(() => {
      onError?.('No se pudo preparar el cambio del contacto.')
    })
  }

  async function removeContact() {
    if (!onRemove || disabled) return
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
  >
    <header className="oanix-contact-block__header">
      <span className="oanix-contact-block__avatar" aria-hidden="true">{initials}</span>
      <div className="oanix-contact-block__heading">
        <strong>{draft.name.trim() || 'Contacto'}</strong>
        <small>{draft.organization.trim() || 'Tarjeta privada'}</small>
      </div>
      {onRemove && <button type="button" className="is-danger" disabled={disabled} onClick={() => void removeContact()}>Eliminar</button>}
    </header>

    <div className="oanix-contact-block__grid">
      <label className="oanix-contact-block__field oanix-contact-block__field--wide">
        <span>Nombre</span>
        <input type="text" value={draft.name} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} placeholder="Nombre del contacto" onChange={(event) => commit('name', event.currentTarget.value)} />
      </label>
      <label className="oanix-contact-block__field">
        <span>Teléfono</span>
        <input type="tel" value={draft.phone} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} placeholder="+504…" onChange={(event) => commit('phone', event.currentTarget.value)} />
      </label>
      <label className="oanix-contact-block__field">
        <span>Correo</span>
        <input type="email" value={draft.email} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} placeholder="nombre@correo.com" onChange={(event) => commit('email', event.currentTarget.value)} />
      </label>
      <label className="oanix-contact-block__field oanix-contact-block__field--wide">
        <span>Organización</span>
        <input type="text" value={draft.organization} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} placeholder="Empresa u organización" onChange={(event) => commit('organization', event.currentTarget.value)} />
      </label>
      <label className="oanix-contact-block__field oanix-contact-block__field--wide">
        <span>Notas</span>
        <textarea value={draft.notes} maxLength={MAX_CONTACT_FIELD_LENGTH} disabled={disabled} rows={3} placeholder="Notas privadas sobre este contacto…" onChange={(event) => commit('notes', event.currentTarget.value)} />
      </label>
    </div>

    {(draft.phone.trim() || draft.email.trim()) && <footer className="oanix-contact-block__actions">
      {draft.phone.trim() && <a href={`tel:${draft.phone.trim()}`} onClick={onActivity}>Llamar</a>}
      {draft.email.trim() && <a href={`mailto:${draft.email.trim()}`} onClick={onActivity}>Correo</a>}
    </footer>}
  </article>
}
