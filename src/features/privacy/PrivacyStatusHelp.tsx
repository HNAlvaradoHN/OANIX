import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../styles/privacy-status-polish.css'

type HelpTopic = 'lock' | 'box'

interface HelpAnchor {
  top: number
  topic: HelpTopic
}

const PRIVACY_ACTIONS_SELECTOR = '.oanix-privacy-actions'

function actionTopic(button: HTMLButtonElement): HelpTopic | null {
  const text = button.textContent ?? ''
  if (/Proteger nota|Desbloquear temporalmente|Quitar protección/.test(text)) return 'lock'
  if (/Caja privada/.test(text)) return 'box'
  return null
}

function mutationTouchesPrivacyActions(record: MutationRecord): boolean {
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
  return nodes.some((node) => {
    if (!(node instanceof Element)) return false
    return node.matches(PRIVACY_ACTIONS_SELECTOR) || node.querySelector(PRIVACY_ACTIONS_SELECTOR) !== null
  })
}

export function PrivacyStatusHelp() {
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  const [anchors, setAnchors] = useState<HelpAnchor[]>([])
  const [helpOpen, setHelpOpen] = useState<HelpTopic | null>(null)

  useEffect(() => {
    let frame = 0
    let actionsObserver: MutationObserver | null = null
    let resizeObserver: ResizeObserver | null = null

    function inspect() {
      const nextHost = document.querySelector<HTMLElement>(PRIVACY_ACTIONS_SELECTOR)
      setActionsHost((current) => current === nextHost ? current : nextHost)

      actionsObserver?.disconnect()
      actionsObserver = null
      resizeObserver?.disconnect()
      resizeObserver = null

      if (!nextHost) {
        setAnchors([])
        setHelpOpen(null)
        return
      }

      actionsObserver = new MutationObserver(scheduleInspect)
      actionsObserver.observe(nextHost, { childList: true, subtree: true, characterData: true })

      resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleInspect)
      resizeObserver?.observe(nextHost)

      const nextAnchors = Array.from(nextHost.querySelectorAll<HTMLButtonElement>(':scope > button:not(.oanix-privacy-action-help)'))
        .flatMap((button) => {
          const topic = actionTopic(button)
          if (!topic) return []
          resizeObserver?.observe(button)
          return [{
            topic,
            top: button.offsetTop + Math.max(0, (button.offsetHeight - 28) / 2),
          }]
        })

      setAnchors((current) => {
        if (
          current.length === nextAnchors.length
          && current.every((item, index) => item.topic === nextAnchors[index]?.topic && Math.abs(item.top - (nextAnchors[index]?.top ?? 0)) < 1)
        ) return current
        return nextAnchors
      })
    }

    function scheduleInspect() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        inspect()
      })
    }

    inspect()
    const portalObserver = new MutationObserver((records) => {
      if (records.some(mutationTouchesPrivacyActions)) scheduleInspect()
    })
    portalObserver.observe(document.body, { childList: true })
    window.addEventListener('resize', scheduleInspect)

    return () => {
      portalObserver.disconnect()
      actionsObserver?.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleInspect)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const helpTitle = helpOpen === 'lock' ? '¿Qué hace Proteger nota?' : '¿Qué hace Caja privada?'

  return (
    <>
      {actionsHost && anchors.map((anchor, index) => createPortal(
        <button
          className="oanix-privacy-action-help"
          type="button"
          aria-label={anchor.topic === 'lock' ? 'Ayuda sobre protección individual de la nota' : 'Ayuda sobre Caja privada'}
          title="Más información"
          style={{ top: `${anchor.top}px` }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setHelpOpen(anchor.topic)
          }}
        >
          ?
        </button>,
        actionsHost,
        `${anchor.topic}-${index}`,
      ))}

      {helpOpen && createPortal(
        <div className="oanix-privacy-help" role="presentation" onClick={() => setHelpOpen(null)}>
          <section
            className="oanix-privacy-help__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="oanix-privacy-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>AYUDA</span>
                <strong id="oanix-privacy-help-title">{helpTitle}</strong>
              </div>
              <button type="button" onClick={() => setHelpOpen(null)} aria-label="Cerrar ayuda">×</button>
            </header>

            <div className="oanix-privacy-help__content">
              {helpOpen === 'lock' ? (
                <article>
                  <span aria-hidden="true">🔒</span>
                  <div>
                    <strong>Protección individual</strong>
                    <p>
                      Añade un código propio de 1 a 20 caracteres a esta nota. El título puede seguir visible, pero el contenido queda oculto hasta introducir ese código. Es una barrera adicional dentro de la bóveda cifrada y no reemplaza tu contraseña maestra.
                    </p>
                  </div>
                </article>
              ) : (
                <article>
                  <span aria-hidden="true">🗄️</span>
                  <div>
                    <strong>Caja privada</strong>
                    <p>
                      Saca esta nota de las listas y búsquedas normales. Para volver a verla tendrás que entrar a Caja privada y confirmar tu identidad. También puedes combinar Caja privada con un código individual para tener las dos barreras.
                    </p>
                  </div>
                </article>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
