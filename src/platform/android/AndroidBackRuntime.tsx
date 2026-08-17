import { useEffect, useRef, useState } from 'react'
import {
  addAndroidBackPressedListener,
  exitAndroidApp,
  isAndroidBackRuntime,
  setAndroidBackHandlingEnabled,
} from './androidBack'

export function AndroidBackRuntime() {
  const [exitPromptVisible, setExitPromptVisible] = useState(false)
  const exitPromptVisibleRef = useRef(false)

  useEffect(() => {
    exitPromptVisibleRef.current = exitPromptVisible
  }, [exitPromptVisible])

  useEffect(() => {
    if (!isAndroidBackRuntime()) return

    let active = true
    let listenerHandle: { remove(): Promise<void> } | null = null

    const handleBack = () => {
      if (!active) return

      if (exitPromptVisibleRef.current) {
        void exitAndroidApp()
        return
      }

      const openNoteBack = document.querySelector<HTMLButtonElement>(
        '.notes-shell--open .back-button',
      )
      if (openNoteBack) {
        openNoteBack.click()
        return
      }

      setExitPromptVisible(true)
    }

    void setAndroidBackHandlingEnabled(true)
      .then(() => addAndroidBackPressedListener(handleBack))
      .then((handle) => {
        if (!active) {
          void handle.remove()
          return
        }
        listenerHandle = handle
      })
      .catch(() => {
        // If native back interception is unavailable, Android keeps its default behavior.
      })

    return () => {
      active = false
      if (listenerHandle) void listenerHandle.remove()
      void setAndroidBackHandlingEnabled(false)
    }
  }, [])

  if (!isAndroidBackRuntime() || !exitPromptVisible) return null

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="oanix-exit-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        display: 'grid',
        placeItems: 'end center',
        padding: '1rem',
        background: 'rgba(2,6,23,.28)',
      }}
    >
      <div
        style={{
          width: 'min(30rem, 100%)',
          display: 'grid',
          gap: '.8rem',
          padding: '1rem',
          border: '1px solid rgba(148,163,184,.3)',
          borderRadius: '1rem',
          background: '#0f172a',
          color: '#f8fafc',
          boxShadow: '0 18px 55px rgba(0,0,0,.35)',
        }}
      >
        <div>
          <strong id="oanix-exit-title">¿Deseas salir de OANIX?</strong>
          <div style={{ marginTop: '.25rem', fontSize: '.8rem', opacity: .72 }}>
            Si vuelves a usar Atrás, OANIX se cerrará.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem' }}>
          <button type="button" onClick={() => setExitPromptVisible(false)}>
            Cancelar
          </button>
          <button type="button" onClick={() => void exitAndroidApp()}>
            Salir
          </button>
        </div>
      </div>
    </aside>
  )
}
