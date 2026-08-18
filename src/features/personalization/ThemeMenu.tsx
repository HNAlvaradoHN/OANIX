import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AUTO_LOCK_OPTIONS,
  readSavedAutoLockMinutes,
  saveAutoLockMinutes,
  type AutoLockMinutes,
} from '../../security/session/autoLockPolicy'
import {
  applyOanixTheme,
  getOanixTheme,
  OANIX_BASE_THEMES,
  OANIX_STYLE_THEMES,
  readSavedOanixTheme,
  type OanixThemePreset,
} from './themeCatalog'
import './personalization.css'
import './personalization-workspace.css'
import './session-auto-lock.css'

export function ThemeMenu() {
  const [open, setOpen] = useState(false)
  const [themeId, setThemeId] = useState(() => readSavedOanixTheme())
  const [autoLockMinutes, setAutoLockMinutes] = useState<AutoLockMinutes>(() => readSavedAutoLockMinutes())
  const [host, setHost] = useState<HTMLElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const currentTheme = getOanixTheme(themeId)

  useEffect(() => {
    function syncHost() {
      const next = document.querySelector<HTMLElement>('.oanix-personalization-slot')
      setHost((current) => current === next ? current : next)
    }

    syncHost()
    const observer = new MutationObserver(syncHost)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!host) setOpen(false)
  }, [host])

  useEffect(() => {
    function handleThemeChange(event: Event) {
      const nextTheme = (event as CustomEvent<string>).detail
      if (nextTheme) setThemeId(nextTheme)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
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
    setOpen(false)
  }

  function chooseAutoLock(nextMinutes: AutoLockMinutes) {
    setAutoLockMinutes(saveAutoLockMinutes(nextMinutes))
  }

  function renderThemeOption(theme: OanixThemePreset) {
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
          {theme.swatches.map((color) => <span key={color} style={{ background: color }} />)}
        </span>
        <span className="oanix-theme-option__copy">
          <strong>{theme.name}</strong>
          <small>{theme.description}</small>
        </span>
        <span className="oanix-theme-option__mode">{theme.mode === 'dark' ? 'Oscuro' : 'Claro'}</span>
        {selected && <span className="oanix-theme-option__check" aria-hidden="true">✓</span>}
      </button>
    )
  }

  const entry = host ? createPortal(
    <button
      ref={triggerRef}
      className="oanix-personalization-trigger"
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      aria-haspopup="dialog"
      title="Personalización"
    >
      <span className="oanix-personalization-trigger__icon" aria-hidden="true">✦</span>
      <span className="oanix-personalization-trigger__copy">
        <strong>Personalización</strong>
        <small>{currentTheme.name}</small>
      </span>
      <span className="oanix-personalization-trigger__chevron" aria-hidden="true">⌄</span>
    </button>,
    host,
  ) : null

  const panel = open ? createPortal(
    <Fragment>
      <button
        className="oanix-theme-backdrop"
        type="button"
        aria-label="Cerrar personalización"
        data-note-menu-root="true"
        onClick={() => setOpen(false)}
      />
      <section
        className="oanix-theme-menu oanix-theme-menu--workspace"
        aria-label="Personalización de OANIX"
        data-note-menu-root="true"
        ref={panelRef}
      >
        <header className="oanix-theme-menu__header">
          <div>
            <span className="oanix-theme-menu__eyebrow">PERSONALIZACIÓN</span>
            <strong>Elegí tu ambiente</strong>
            <p>El tema se aplica al instante y se guarda solo en este dispositivo.</p>
          </div>
          <button className="oanix-theme-menu__close" type="button" onClick={() => setOpen(false)} aria-label="Cerrar personalización">×</button>
        </header>

        <div className="oanix-theme-menu__content">
          <section className="oanix-theme-section" aria-labelledby="oanix-theme-base-title">
            <div className="oanix-theme-section__heading">
              <strong id="oanix-theme-base-title">Base</strong>
              <span>Día y noche neutrales</span>
            </div>
            <div className="oanix-theme-menu__grid oanix-theme-menu__grid--base" role="list" aria-label="Temas base">
              {OANIX_BASE_THEMES.map(renderThemeOption)}
            </div>
          </section>

          <section className="oanix-theme-section" aria-labelledby="oanix-theme-style-title">
            <div className="oanix-theme-section__heading">
              <strong id="oanix-theme-style-title">10 ambientes</strong>
              <span>Colores con personalidad propia</span>
            </div>
            <div className="oanix-theme-menu__grid" role="list" aria-label="Diez temas especiales">
              {OANIX_STYLE_THEMES.map(renderThemeOption)}
            </div>
          </section>

          <section className="oanix-theme-section oanix-security-section" aria-labelledby="oanix-auto-lock-title">
            <div className="oanix-theme-section__heading">
              <strong id="oanix-auto-lock-title">Seguridad</strong>
              <span>Bloqueo automático al dejar OANIX</span>
            </div>
            <div className="oanix-auto-lock" role="radiogroup" aria-label="Tiempo de bloqueo automático">
              {AUTO_LOCK_OPTIONS.map((option) => {
                const selected = option.minutes === autoLockMinutes
                return (
                  <button
                    key={option.minutes}
                    className={`oanix-auto-lock__option${selected ? ' oanix-auto-lock__option--selected' : ''}`}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseAutoLock(option.minutes)}
                  >
                    <span>{option.label}</span>
                    {option.minutes === 5 && <small>Recomendado</small>}
                    {selected && <strong aria-hidden="true">✓</strong>}
                  </button>
                )
              })}
            </div>
            <p className="oanix-auto-lock__hint">El botón 🔒 siempre bloquea de inmediato.</p>
          </section>
        </div>
      </section>
    </Fragment>,
    document.body,
  ) : null

  return <>{entry}{panel}</>
}
