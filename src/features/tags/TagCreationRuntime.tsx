import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createTag, loadTags } from './tagService'
import './tagCreation.css'

function organicTagAddButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('.oanix-organic-tags__controls button')
}

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function TagCreationRuntime() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const decorate = () => {
      const addButton = organicTagAddButton()
      if (!addButton) return
      addButton.setAttribute('aria-label', 'Crear nueva etiqueta')
      addButton.title = 'Crear nueva etiqueta'
    }

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const addButton = target.closest<HTMLButtonElement>('.oanix-organic-tags__controls button')
      if (addButton) {
        event.preventDefault()
        event.stopPropagation()
        setError('')
        setName('')
        setOpen(true)
        return
      }

      const allChip = target.closest<HTMLButtonElement>('.oanix-organic-tag-chip:first-child')
      if (allChip && !document.querySelector('[data-oanix-organic-tag-id]')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    decorate()
    const observer = new MutationObserver(decorate)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', handleClickCapture, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClickCapture, true)
    }
  }, [])

  async function handleCreate() {
    if (busy) return
    const normalized = normalizeTagName(name)
    if (!normalized) {
      setError('Escribe un nombre para la etiqueta.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const existing = await loadTags()
      if (existing.some((tag) => tag.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
        setError('Ya existe una etiqueta con ese nombre.')
        return
      }
      await createTag(normalized)
      window.dispatchEvent(new Event('oanix:local-data-changed'))
      setOpen(false)
      setName('')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la etiqueta.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="oanix-tag-create-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget && !busy) setOpen(false)
    }}>
      <section
        className="oanix-tag-create"
        role="dialog"
        aria-modal="true"
        aria-label="Crear nueva etiqueta"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header><span aria-hidden="true">🏷</span><strong>Crear nueva etiqueta</strong></header>
        <label>
          <span>NOMBRE</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void handleCreate()
              if (event.key === 'Escape' && !busy) setOpen(false)
            }}
            maxLength={40}
            placeholder="Ej. Trabajo"
            aria-label="Nombre de nueva etiqueta"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" className="is-cancel" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
          <button type="button" className="is-primary" onClick={() => void handleCreate()} disabled={busy}>
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
