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

export function ThemeMenu() {
  const [open, setOpen] = useState(false)
  const [themeId, setThemeId] = useState(() => readSavedOanixTheme())
  const [autoLockMinutes, setAutoLockMinutes] = useState<AutoLockMinutes>(() => readSavedAutoLockMinutes())
  const [workspaceMenu, setWorkspaceMenu] = useState<HTMLElement | null>(null)
  const entryRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const currentTheme = getOanixTheme(themeId)

  function closeThemeAndWorkspaceMenu() {
    setOpen(false)
    window.requestAnimationFrame(() => {
      const opener = document.querySelector<HTMLButtonElement>(
        '.workspace-menu-wrap > button[aria-label="Menú de OANIX"]',
      )
      if (opener?.getAttribute('aria-expanded') === 'true') opener.click()
    })
  }

  useEffect(() => {
    function syncWorkspaceMenu() {
      const next = document.querySelector<HTMLElement>('.workspace-menu[role="menu"]')
      setWorkspaceMenu((current) => current === next ? current : next)
    }

    syncWorkspaceMenu()
    const observer = new MutationObserver(syncWorkspaceMenu)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!workspaceMenu) setOpen(false)
  }, [workspaceMenu])

  useEffect(() => {
    function handleThemeChange(event: Event) {
      const nextTheme = (event as CustomEvent<string>).detail
      if (nextTheme) setThemeId(nextTheme)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (entryRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeThemeAndWorkspaceMenu()
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
    closeThemeAndWorkspaceMenu()
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
  }

  const menuEntry = workspaceMenu ? createPortal(
    <div className="oanix-personalization__workspace-entry" ref={entryRef}>
      <button
        className="oanix-personalization__menuitem"
        type="button"
        role="menuitem"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="oanix-personalization__menuitem-icon" aria-hidden="true">✦</span>
        <span className="oanix-personalization__menuitem-copy">
          <strong>Personalización</strong>
          <small>{currentTheme.name}</small>
        </span>
        <span className="oanix-personalization__menuitem-chevron" aria-hidden="true">›</span>
      </button>
    </div>,
    workspaceMenu,
  ) : null

  const themePanel = open ? createPortal(
    <Fragment>
      <button
        className="oanix-theme-backdrop"
        type="button"
        aria-label="Cerrar personalización"
        data-note-menu-root="true"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={closeThemeAndWorkspaceMenu}
      />
      <section
        className="oanix-theme-menu oanix-theme-menu--workspace"
        aria-label="Personalización de OANIX"
        data-note-menu-root="true"
        ref={panelRef}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="oanix-theme-menu__header">
          <div>
            <span className="oanix-theme-menu__eyebrow">PERSONALIZACIÓN</span>
            <strong>Ajustá OANIX a tu gusto</strong>
            <p>El tema y el tiempo de bloqueo se guardan solo en este dispositivo.</p>
          </div>
          <button
            className="oanix-theme-menu__close"
            type="button"
            onClick={closeThemeAndWorkspaceMenu}
            aria-label="Cerrar personalización"
          >
            ×
          </button>
        </header>

        <div className="oanix-theme-menu__content">
          <section className="oanix-theme-section" aria-labelledby="oanix-theme-base-title">
            <div className="oanix-theme-section__heading">
              <strong id="oanix-theme-base-title">Base</strong>
              <span>Día y noche sin estilo dominante</span>
            </div>
            <div className="oanix-theme-menu__grid oanix-theme-menu__grid--base" role="list" aria-label="Temas base">
              {OANIX_BASE_THEMES.map(renderThemeOption)}
            </div>
          </section>

          <section className="oanix-theme-section oanix-security-section" aria-labelledby="oanix-auto-lock-title">
            <div className="oanix-theme-section__heading">
              <strong id="oanix-auto-lock-title">Seguridad</strong>
              <span>Bloqueo automático al dejar OANIX en segundo plano</span>
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
            <p className="oanix-auto-lock__hint">
              Si volvés antes del tiempo elegido, seguís donde estabas. El botón 🔒 siempre bloquea de inmediato.
            </p>
          </section>

          <section className="oanix-theme-section" aria-labelledby="oanix-theme-style-title">
            <div className="oanix-theme-section__heading">
              <strong id="oanix-theme-style-title">Ambientes</strong>
              <span>Presets con personalidad propia</span>
            </div>
            <div className="oanix-theme-menu__grid" role="list" aria-label="Temas especiales">
              {OANIX_STYLE_THEMES.map(renderThemeOption)}
            </div>
          </section>
        </div>
      </section>
    </Fragment>,
    document.body,
  ) : null

  return <>{menuEntry}{themePanel}</>
}
