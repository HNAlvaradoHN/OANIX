import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AUTO_LOCK_OPTIONS,
  readSavedAutoLockMinutes,
  saveAutoLockMinutes,
  type AutoLockMinutes,
} from '../../security/session/autoLockPolicy'
import './personalization.css'
import './personalization-workspace.css'
import './session-auto-lock.css'

const WORKSPACE_SELECTOR = '.notes-shell'
const WORKSPACE_MENU_SELECTOR = '.workspace-menu[role="menu"]'

function mutationTouchesSelector(record: MutationRecord, selector: string): boolean {
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
  return nodes.some((node) => {
    if (!(node instanceof Element)) return false
    return node.matches(selector) || node.querySelector(selector) !== null
  })
}

export function ThemeMenu() {
  const [open, setOpen] = useState(false)
  const [autoLockMinutes, setAutoLockMinutes] = useState<AutoLockMinutes>(() => readSavedAutoLockMinutes())
  const [workspaceMenu, setWorkspaceMenu] = useState<HTMLElement | null>(null)
  const entryRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  function closeSecurityAndWorkspaceMenu() {
    setOpen(false)
    window.requestAnimationFrame(() => {
      const opener = document.querySelector<HTMLButtonElement>(
        '.workspace-menu-wrap > button[aria-label="Menú de OANIX"]',
      )
      if (opener?.getAttribute('aria-expanded') === 'true') opener.click()
    })
  }

  useEffect(() => {
    const appRoot = document.getElementById('root')
    let workspace: HTMLElement | null = null
    let workspaceMenuObserver: MutationObserver | null = null

    function syncWorkspaceMenu() {
      const next = workspace?.querySelector<HTMLElement>(WORKSPACE_MENU_SELECTOR) ?? null
      setWorkspaceMenu((current) => current === next ? current : next)
    }

    function bindWorkspace() {
      const nextWorkspace = document.querySelector<HTMLElement>(WORKSPACE_SELECTOR)
      if (nextWorkspace === workspace) {
        syncWorkspaceMenu()
        return
      }

      workspaceMenuObserver?.disconnect()
      workspace = nextWorkspace
      syncWorkspaceMenu()

      if (!workspace) {
        workspaceMenuObserver = null
        return
      }

      workspaceMenuObserver = new MutationObserver((records) => {
        if (records.some((record) => mutationTouchesSelector(record, WORKSPACE_MENU_SELECTOR))) {
          syncWorkspaceMenu()
        }
      })
      workspaceMenuObserver.observe(workspace, { childList: true, subtree: true })
    }

    bindWorkspace()
    if (!appRoot) return () => workspaceMenuObserver?.disconnect()

    const workspaceHostObserver = new MutationObserver((records) => {
      if (records.some((record) => mutationTouchesSelector(record, WORKSPACE_SELECTOR))) {
        bindWorkspace()
      }
    })
    workspaceHostObserver.observe(appRoot, { childList: true, subtree: true })

    return () => {
      workspaceHostObserver.disconnect()
      workspaceMenuObserver?.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!workspaceMenu) setOpen(false)
  }, [workspaceMenu])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (entryRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeSecurityAndWorkspaceMenu()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function chooseAutoLock(nextMinutes: AutoLockMinutes) {
    setAutoLockMinutes(saveAutoLockMinutes(nextMinutes))
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
        <span className="oanix-personalization__menuitem-icon" aria-hidden="true">🔒</span>
        <span className="oanix-personalization__menuitem-copy">
          <strong>Seguridad</strong>
          <small>Bloqueo automático</small>
        </span>
        <span className="oanix-personalization__menuitem-chevron" aria-hidden="true">›</span>
      </button>
    </div>,
    workspaceMenu,
  ) : null

  const securityPanel = open ? createPortal(
    <Fragment>
      <button
        className="oanix-theme-backdrop"
        type="button"
        aria-label="Cerrar seguridad"
        data-note-menu-root="true"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={closeSecurityAndWorkspaceMenu}
      />
      <section
        className="oanix-theme-menu oanix-theme-menu--workspace"
        aria-label="Seguridad de OANIX"
        data-note-menu-root="true"
        ref={panelRef}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="oanix-theme-menu__header">
          <div>
            <span className="oanix-theme-menu__eyebrow">SEGURIDAD</span>
            <strong>Bloqueo automático</strong>
            <p>Elegí cuánto tiempo puede quedar OANIX en segundo plano antes de volver a pedir acceso.</p>
          </div>
          <button
            className="oanix-theme-menu__close"
            type="button"
            onClick={closeSecurityAndWorkspaceMenu}
            aria-label="Cerrar seguridad"
          >
            ×
          </button>
        </header>

        <div className="oanix-theme-menu__content">
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
        </div>
      </section>
    </Fragment>,
    document.body,
  ) : null

  return <>{menuEntry}{securityPanel}</>
}
