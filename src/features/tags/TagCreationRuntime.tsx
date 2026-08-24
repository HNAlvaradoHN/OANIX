import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { createTag, loadTags } from './tagService'
import {
  DEFAULT_TAG_COLOR,
  DEFAULT_TAG_ICON,
  TAG_COLOR_OPTIONS,
  TAG_ICON_OPTIONS,
} from './tagTypes'
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
  const [icon, setIcon] = useState(DEFAULT_TAG_ICON)
  const [color, setColor] = useState(DEFAULT_TAG_COLOR)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const decorateTokenRef = useRef(0)

  function resetDraft() {
    setName('')
    setIcon(DEFAULT_TAG_ICON)
    setColor(DEFAULT_TAG_COLOR)
    setError('')
  }

  useEffect(() => {
    let frame = 0

    const decorate = async () => {
      const token = ++decorateTokenRef.current
      const addButton = organicTagAddButton()
      if (addButton) {
        addButton.setAttribute('aria-label', 'Crear nueva etiqueta')
        addButton.title = 'Crear nueva etiqueta'
      }

      try {
        const tags = await loadTags()
        if (token !== decorateTokenRef.current) return
        const byId = new Map(tags.map((tag) => [tag.id, tag]))
        document.querySelectorAll<HTMLButtonElement>('.oanix-organic-tag-chip[data-oanix-organic-tag-id]').forEach((chip) => {
          const id = chip.dataset.oanixOrganicTagId
          const tag = id ? byId.get(id) : null
          if (!tag) return
          chip.dataset.oanixTagIcon = tag.icon || DEFAULT_TAG_ICON
          chip.style.setProperty('--oanix-tag-color', tag.color || DEFAULT_TAG_COLOR)
        })
      } catch {
        // The workspace owns storage errors. Tag appearance decoration is best-effort.
      }
    }

    const scheduleDecorate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => void decorate())
    }

    const handleLocalChange = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { recordType?: unknown } | null
        : null
      if (
        typeof detail?.recordType === 'string'
        && detail.recordType !== 'tag'
        && detail.recordType !== 'tag-order'
      ) {
        return
      }
      scheduleDecorate()
    }

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const addButton = target.closest<HTMLButtonElement>('.oanix-organic-tags__controls button')
      if (addButton) {
        event.preventDefault()
        event.stopPropagation()
        resetDraft()
        setOpen(true)
        return
      }

      const allChip = target.closest<HTMLButtonElement>('.oanix-organic-tag-chip:first-child')
      if (allChip && !document.querySelector('[data-oanix-organic-tag-id]')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    scheduleDecorate()
    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    let observer: MutationObserver | null = null
    if (workspace) {
      observer = new MutationObserver(scheduleDecorate)
      observer.observe(workspace, { childList: true, subtree: true })
    }
    window.addEventListener('oanix:local-data-changed', handleLocalChange)
    document.addEventListener('click', handleClickCapture, true)

    return () => {
      observer?.disconnect()
      window.cancelAnimationFrame(frame)
      window.removeEventListener('oanix:local-data-changed', handleLocalChange)
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
      await createTag(normalized, { icon, color })
      setOpen(false)
      resetDraft()
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
        aria-label="Nueva etiqueta"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <span className="oanix-tag-create__title-icon" aria-hidden="true">🏷️</span>
          <strong>Nueva etiqueta</strong>
        </header>

        <label className="oanix-tag-create__field">
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
            placeholder="Ej. Proyectos 2026..."
            aria-label="Nombre de nueva etiqueta"
          />
        </label>

        <fieldset className="oanix-tag-create__section">
          <legend>ICONO</legend>
          <div className="oanix-tag-create__icons">
            {TAG_ICON_OPTIONS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === icon ? 'is-selected' : ''}
                aria-label={`Usar icono ${candidate}`}
                aria-pressed={candidate === icon}
                onClick={() => setIcon(candidate)}
              >
                {candidate}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="oanix-tag-create__section">
          <legend>COLOR</legend>
          <div className="oanix-tag-create__colors">
            {TAG_COLOR_OPTIONS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === color ? 'is-selected' : ''}
                aria-label={`Usar color ${candidate}`}
                aria-pressed={candidate === color}
                style={{ '--oanix-tag-create-color': candidate } as CSSProperties}
                onClick={() => setColor(candidate)}
              />
            ))}
          </div>
        </fieldset>

        {error && <p className="oanix-tag-create__error" role="alert">{error}</p>}

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