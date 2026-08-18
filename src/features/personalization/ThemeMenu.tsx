import { useEffect, useRef, useState } from 'react'
import {
  applyOanixTheme,
  getOanixTheme,
  OANIX_THEMES,
  readSavedOanixTheme,
} from './themeCatalog'
import './personalization.css'

export function ThemeMenu() {
  const [open, setOpen] = useState(false)
  const [themeId, setThemeId] = useState(() => readSavedOanixTheme())
  const rootRef = useRef<HTMLDivElement | null>(null)
  const currentTheme = getOanixTheme(themeId)

  useEffect(() => {
    function handleThemeChange(event: Event) {
      const nextTheme = (event as CustomEvent<string>).detail
      if (nextTheme) setThemeId(nextTheme)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('oanix:theme-change', handleThemeChange)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('oanix:theme-change', handleThemeChange)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function chooseTheme(nextThemeId: string) {
    setThemeId(applyOanixTheme(nextThemeId))
  }

  return (
    <div className="oanix-personalization" ref={rootRef}>
      <button
        className="oanix-personalization__trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Personalización. Tema actual: ${currentTheme.name}`}
        title="Personalización"
      >
        <span className="oanix-personalization__trigger-icon" aria-hidden="true">✦</span>
        <span className="oanix-personalization__trigger-label">Personalizar</span>
        <span className="oanix-personalization__trigger-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <section className="oanix-theme-menu" aria-label="Personalización de OANIX">
          <header className="oanix-theme-menu__header">
            <div>
              <span className="oanix-theme-menu__eyebrow">PERSONALIZACIÓN</span>
              <strong>Elegí tu ambiente</strong>
              <p>El tema se guarda solo en este dispositivo.</p>
            </div>
            <button
              className="oanix-theme-menu__close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar personalización"
            >
              ×
            </button>
          </header>

          <div className="oanix-theme-menu__grid" role="list" aria-label="Temas disponibles">
            {OANIX_THEMES.map((theme) => {
              const selected = theme.id === themeId
              return (
                <button
                  key={theme.id}
                  className={`oanix-theme-option${selected ? ' oanix-theme-option--selected' : ''}`}
                  type="button"
                  onClick={() => chooseTheme(theme.id)}
                  aria-pressed={selected}
                  role="listitem"
                >
                  <span className="oanix-theme-option__swatches" aria-hidden="true">
                    {theme.swatches.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className="oanix-theme-option__copy">
                    <strong>{theme.name}</strong>
                    <small>{theme.description}</small>
                  </span>
                  <span className="oanix-theme-option__mode">{theme.mode === 'dark' ? 'Oscuro' : 'Claro'}</span>
                  {selected && <span className="oanix-theme-option__check" aria-hidden="true">✓</span>}
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
