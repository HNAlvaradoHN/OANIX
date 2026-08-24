import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  NOTEBOOK_PAPER_CHANGE_EVENT,
  readNotebookPaperMode,
  saveNotebookPaperMode,
  type NotebookPaperMode,
} from './notebookPaper'

export function NotebookPaperPreference() {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [mode, setMode] = useState<NotebookPaperMode>(() => readNotebookPaperMode())

  useEffect(() => {
    function syncHost() {
      const next = document.querySelector<HTMLElement>('.oanix-theme-menu__content')
      setHost((current) => current === next ? current : next)
    }

    function syncMode(event: Event) {
      const next = (event as CustomEvent<NotebookPaperMode>).detail
      if (next) setMode(next)
    }

    syncHost()
    const observer = new MutationObserver(syncHost)
    observer.observe(document.body, { childList: true })
    window.addEventListener(NOTEBOOK_PAPER_CHANGE_EVENT, syncMode)
    return () => {
      observer.disconnect()
      window.removeEventListener(NOTEBOOK_PAPER_CHANGE_EVENT, syncMode)
    }
  }, [])

  if (!host) return null

  return createPortal(
    <section className="oanix-theme-section oanix-paper-section" aria-labelledby="oanix-paper-title">
      <div className="oanix-theme-section__heading">
        <strong id="oanix-paper-title">Hoja</strong>
        <span>La misma maqueta interna; vos decidís si los renglones se ven.</span>
      </div>
      <div className="oanix-paper-options" role="radiogroup" aria-label="Estilo de la hoja de notas">
        {([
          ['plain', 'Lisa', 'Cuadrícula invisible'],
          ['ruled', 'Cuaderno', 'Renglones alineados al texto'],
        ] as const).map(([value, label, description]) => {
          const selected = mode === value
          return (
            <button
              key={value}
              className={`oanix-paper-option${selected ? ' oanix-paper-option--selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(saveNotebookPaperMode(value))}
            >
              <span className={`oanix-paper-option__preview oanix-paper-option__preview--${value}`} aria-hidden="true" />
              <span className="oanix-paper-option__copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              {selected && <span className="oanix-paper-option__check" aria-hidden="true">✓</span>}
            </button>
          )
        })}
      </div>
      <p className="oanix-paper-section__hint">
        En ambos modos, tocar una zona vacía coloca el cursor al inicio del renglón elegido.
      </p>
    </section>,
    host,
  )
}
