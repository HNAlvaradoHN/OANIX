import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type PrivacyHelpTopic = 'lock' | 'private-box'

interface StatusHosts {
  lock: HTMLElement | null
  privateBox: HTMLElement | null
}

const EMPTY_HOSTS: StatusHosts = { lock: null, privateBox: null }

export function PrivacyStatusHelp() {
  const [hosts, setHosts] = useState<StatusHosts>(EMPTY_HOSTS)
  const [helpTopic, setHelpTopic] = useState<PrivacyHelpTopic | null>(null)

  useEffect(() => {
    let frame = 0

    function inspect() {
      const status = document.querySelector<HTMLElement>('.oanix-privacy-status')
      const rows = status
        ? Array.from(status.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
        : []
      const next: StatusHosts = {
        lock: rows[0] ?? null,
        privateBox: rows[1] ?? null,
      }

      setHosts((current) => (
        current.lock === next.lock && current.privateBox === next.privateBox ? current : next
      ))
      if (!status) setHelpTopic(null)
    }

    function scheduleInspect() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        inspect()
      })
    }

    inspect()
    const observer = new MutationObserver(scheduleInspect)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const topicIsLock = helpTopic === 'lock'

  return (
    <>
      {hosts.lock && createPortal(
        <button
          className="oanix-privacy-status__help-button"
          type="button"
          aria-label="Ayuda sobre Protección individual"
          title="¿Qué hace Protección individual?"
          onClick={() => setHelpTopic('lock')}
        >
          ?
        </button>,
        hosts.lock,
      )}

      {hosts.privateBox && createPortal(
        <button
          className="oanix-privacy-status__help-button"
          type="button"
          aria-label="Ayuda sobre Caja privada"
          title="¿Qué hace Caja privada?"
          onClick={() => setHelpTopic('private-box')}
        >
          ?
        </button>,
        hosts.privateBox,
      )}

      {helpTopic && createPortal(
        <div className="oanix-privacy-help" role="presentation" onClick={() => setHelpTopic(null)}>
          <section
            className="oanix-privacy-help__panel oanix-privacy-help__panel--single"
            role="dialog"
            aria-modal="true"
            aria-labelledby="oanix-privacy-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>AYUDA</span>
                <strong id="oanix-privacy-help-title">
                  {topicIsLock ? 'Protección individual' : 'Caja privada'}
                </strong>
              </div>
              <button type="button" onClick={() => setHelpTopic(null)} aria-label="Cerrar ayuda">×</button>
            </header>

            <div className="oanix-privacy-help__content oanix-privacy-help__content--single">
              {topicIsLock ? (
                <article>
                  <span aria-hidden="true">🔒</span>
                  <div>
                    <strong>Una barrera adicional para esta nota</strong>
                    <p>
                      Indica si la nota tiene un código propio. Al activarlo, el título puede seguir visible, pero el contenido queda oculto hasta introducir ese código. Es una protección adicional dentro de la bóveda cifrada de OANIX y no sustituye tu contraseña maestra.
                    </p>
                  </div>
                </article>
              ) : (
                <article>
                  <span aria-hidden="true">🗄️</span>
                  <div>
                    <strong>Un espacio apartado de la vista normal</strong>
                    <p>
                      Indica si la nota está dentro de Caja privada. Allí deja de aparecer en las listas y búsquedas normales, y OANIX vuelve a pedir autenticación para entrar a ese espacio.
                    </p>
                  </div>
                </article>
              )}

              <p className="oanix-privacy-help__note">
                Este renglón solo informa el estado actual. Para cambiarlo, usa el botón de acción correspondiente que aparece debajo.
              </p>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
