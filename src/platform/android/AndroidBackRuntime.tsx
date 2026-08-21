import { useEffect, useRef, useState } from 'react'
import { useFolderNavigationRuntime } from '../../features/folders/folderNavigationRuntime'
import {
  addAndroidBackPressedListener,
  exitAndroidApp,
  isAndroidBackRuntime,
  setAndroidBackHandlingEnabled,
} from './androidBack'

export function AndroidBackRuntime() {
  useFolderNavigationRuntime()

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

      const folderHomeBack = document.querySelector<HTMLButtonElement>(
        '[data-oanix-folder-home-back="true"]',
      )
      if (folderHomeBack) {
        folderHomeBack.click()
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
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setExitPromptVisible(false)
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        display: 'grid',
        placeItems: 'end center',
        padding: '1rem',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        background: 'rgba(2,6,23,.24)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          width: 'min(29rem, 100%)',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: '.85rem',
          padding: '1rem',
          border: '1px solid rgba(148,163,184,.22)',
          borderRadius: '1.2rem',
          background: 'linear-gradient(180deg, rgba(15,23,42,.94), rgba(15,23,42,.88))',
          color: '#f8fafc',
          boxShadow: '0 22px 70px rgba(0,0,0,.42), inset 0 1px rgba(255,255,255,.04)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '2.7rem',
            height: '2.7rem',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '.9rem',
            background: 'rgba(96,165,250,.12)',
            border: '1px solid rgba(96,165,250,.22)',
            fontSize: '1.2rem',
          }}
        >
          ↗
        </div>

        <div style={{ minWidth: 0 }}>
          <strong id="oanix-exit-title" style={{ display: 'block', fontSize: '1rem', letterSpacing: '-.01em' }}>
            ¿Deseas salir de OANIX?
          </strong>
          <div style={{ marginTop: '.28rem', fontSize: '.8rem', lineHeight: 1.45, color: 'rgba(226,232,240,.72)' }}>
            Tus cambios guardados permanecen cifrados. Si vuelves a usar Atrás, OANIX se cerrará.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.55rem', marginTop: '.9rem' }}>
            <button
              type="button"
              onClick={() => setExitPromptVisible(false)}
              style={{
                minHeight: '2.45rem',
                padding: '.48rem .82rem',
                border: '1px solid rgba(148,163,184,.28)',
                borderRadius: '.72rem',
                background: 'rgba(255,255,255,.045)',
                color: '#e2e8f0',
                fontWeight: 750,
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void exitAndroidApp()}
              style={{
                minHeight: '2.45rem',
                padding: '.48rem .9rem',
                border: '1px solid rgba(96,165,250,.38)',
                borderRadius: '.72rem',
                background: 'rgba(59,130,246,.18)',
                color: '#eff6ff',
                fontWeight: 850,
              }}
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
