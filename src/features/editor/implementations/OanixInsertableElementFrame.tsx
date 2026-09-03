import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import './oanixInsertableElementFrame.css'

export type OanixInsertableElementKind =
  | 'entry'
  | 'image'
  | 'file'
  | 'code'
  | 'checklist'
  | 'contact'
  | 'separator'
  | 'text'

interface OanixInsertableElementFrameProps {
  elementId: string
  kind: OanixInsertableElementKind
  title: string
  meta?: string
  preview: ReactNode
  expanded?: ReactNode
  disabled?: boolean
  onRemove?: () => void | Promise<void>
  children?: ReactNode
}

function kindLabel(kind: OanixInsertableElementKind): string {
  if (kind === 'entry') return 'Entrada'
  if (kind === 'image') return 'Imagen'
  if (kind === 'file') return 'Archivo'
  if (kind === 'code') return 'Código'
  if (kind === 'checklist') return 'Checklist'
  if (kind === 'contact') return 'Contacto'
  if (kind === 'text') return 'Texto largo'
  return 'Separador'
}

/**
 * Shared visual shell for atomic OANIX Notes elements.
 *
 * It deliberately owns presentation only. Persistence, encrypted assets and note
 * ordering remain outside. Keeping one menu/expansion implementation prevents every
 * element type from inventing a different mobile interaction model.
 */
export function OanixInsertableElementFrame({
  elementId,
  kind,
  title,
  meta,
  preview,
  expanded,
  disabled = false,
  onRemove,
  children,
}: OanixInsertableElementFrameProps) {
  const hostRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('down')
  const [expandedOpen, setExpandedOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  function openMenu() {
    if (disabled) return
    const host = hostRef.current
    if (host) {
      const bounds = host.getBoundingClientRect()
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const viewportTop = window.visualViewport?.offsetTop ?? 0
      const spaceBelow = viewportTop + viewportHeight - bounds.bottom
      const spaceAbove = bounds.top - viewportTop
      setMenuDirection(spaceBelow < 220 && spaceAbove > spaceBelow ? 'up' : 'down')
    }
    setMenuOpen(true)
  }

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (hostRef.current?.contains(target) || menuRef.current?.contains(target))) return
      closeMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    const onScroll = () => closeMenu()

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.visualViewport?.addEventListener('resize', onScroll)
    window.visualViewport?.addEventListener('scroll', onScroll)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.visualViewport?.removeEventListener('resize', onScroll)
      window.visualViewport?.removeEventListener('scroll', onScroll)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!expandedOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expandedOpen])

  async function removeElement() {
    closeMenu()
    if (!onRemove || disabled) return
    if (!window.confirm(`¿Eliminar ${kindLabel(kind).toLocaleLowerCase()} “${title}”?`)) return
    await onRemove()
  }

  const canExpand = expanded !== undefined

  return <>
    <article
      ref={hostRef}
      className={`oanix-insertable oanix-insertable--${kind}`}
      data-oanix-element-id={elementId}
      data-oanix-element-kind={kind}
    >
      <div className="oanix-insertable__header">
        <div className="oanix-insertable__identity">
          <span className="oanix-insertable__kind">{kindLabel(kind)}</span>
          <strong>{title}</strong>
          {meta && <small>{meta}</small>}
        </div>
        <button
          type="button"
          className="oanix-insertable__menu-button"
          aria-label={`Opciones de ${title}`}
          aria-expanded={menuOpen}
          disabled={disabled}
          onClick={() => menuOpen ? closeMenu() : openMenu()}
        >•••</button>
      </div>

      <div className="oanix-insertable__preview">{preview}</div>
      {children}

      {menuOpen && <div
        ref={menuRef}
        className="oanix-insertable__menu"
        data-direction={menuDirection}
        role="menu"
        aria-label={`Opciones de ${title}`}
      >
        {canExpand && <button type="button" role="menuitem" onClick={() => { closeMenu(); setExpandedOpen(true) }}>Ver completo</button>}
        {onRemove && <button type="button" role="menuitem" className="is-danger" disabled={disabled} onClick={() => void removeElement()}>Eliminar</button>}
      </div>}
    </article>

    {expandedOpen && canExpand && <div
      className="oanix-insertable-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${kindLabel(kind)} completa`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setExpandedOpen(false)
      }}
    >
      <section className="oanix-insertable-viewer__panel">
        <header>
          <div><span>{kindLabel(kind)}</span><strong>{title}</strong></div>
          <button type="button" aria-label="Cerrar" onClick={() => setExpandedOpen(false)}>×</button>
        </header>
        <div className="oanix-insertable-viewer__content">{expanded}</div>
      </section>
    </div>}
  </>
}
