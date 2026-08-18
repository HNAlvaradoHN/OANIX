import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function PrivacyStatusHelp() {
  const [statusHost, setStatusHost] = useState<HTMLElement | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    let frame = 0

    function inspect() {
      const nextHost = document.querySelector<HTMLElement>('.oanix-privacy-status')
      setStatusHost((current) => current === nextHost ? current : nextHost)
      if (!nextHost) setHelpOpen(false)
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

  return (
    <>
      {statusHost && createPortal(
        <div className="oanix-privacy-status__heading">
          <div>
            <span>ESTADO</span>
            <strong>Estado de privacidad</strong>
          </div>
          <button
            type="button"
            aria-label="¿Qué significa el estado de privacidad?"
            title="¿Qué significa cada estado?"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
        </div>,
        statusHost,
      )}

      {helpOpen && createPortal(
        <div className="oanix-privacy-help" role="presentation" onClick={() => setHelpOpen(false)}>
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
                <strong id="oanix-privacy-help-title">¿Qué significa cada estado?</strong>
              </div>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Cerrar ayuda">×</button>
            </header>

            <div className="oanix-privacy-help__content">
              <article>
                <span aria-hidden="true">🔒</span>
                <div>
                  <strong>Protección individual</strong>
                  <p>
                    Te dice si esta nota tiene un código adicional. Si está activado, el contenido queda oculto hasta introducir ese código. Es una barrera extra dentro de la bóveda cifrada de OANIX.
                  </p>
                </div>
              </article>

              <article>
                <span aria-hidden="true">🗄️</span>
                <div>
                  <strong>Caja privada</strong>
                  <p>
                    Te dice dónde está la nota. Si está en Caja privada, deja de aparecer en las listas y búsquedas normales y OANIX vuelve a pedir autenticación para entrar a ese espacio.
                  </p>
                </div>
              </article>

              <p className="oanix-privacy-help__note">
                Estos dos renglones solo muestran el estado actual. Para cambiarlo, usa los botones de acción que aparecen debajo.
              </p>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
