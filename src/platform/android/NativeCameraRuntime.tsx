import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { captureAndroidCameraPhoto, isAndroidNativeCameraRuntime } from './nativeCamera'

function editorRootFor(host: HTMLElement | null): HTMLElement | null {
  return host?.closest<HTMLElement>('.image-note-editor-root') ?? null
}

function rememberCurrentInsertionPoint(root: HTMLElement): void {
  const imageTool = root.querySelector<HTMLButtonElement>('[data-image-tool="true"]')
  if (!imageTool) return

  imageTool.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window,
  }))
}

function sendFileThroughExistingImageInput(root: HTMLElement, file: File): void {
  const input = root.querySelector<HTMLInputElement>('input.image-note-editor__input[type="file"]')
  if (!input) throw new Error('No se encontró el importador cifrado de imágenes de OANIX.')
  if (typeof DataTransfer === 'undefined') {
    throw new Error('Este WebView no permite entregar la foto al editor de OANIX.')
  }

  const transfer = new DataTransfer()
  transfer.items.add(file)
  input.files = transfer.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

export function NativeCameraRuntime() {
  const [insertHost, setInsertHost] = useState<HTMLElement | null>(null)
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAndroidNativeCameraRuntime()) return

    const syncHosts = () => {
      const nextInsertHost = document.querySelector<HTMLElement>('.editor-command-grid--insert')
      const nextToolbarHost = document.querySelector<HTMLElement>('.image-note-editor-root .editor-toolbar')
      setInsertHost((current) => current === nextInsertHost ? current : nextInsertHost)
      setToolbarHost((current) => current === nextToolbarHost ? current : nextToolbarHost)
    }

    syncHosts()
    const appRoot = document.getElementById('root')
    if (!appRoot) return
    const observer = new MutationObserver(syncHosts)
    observer.observe(appRoot, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!isAndroidNativeCameraRuntime()) return null

  async function captureFrom(host: HTMLElement | null) {
    if (busy) return
    const root = editorRootFor(host) ?? document.querySelector<HTMLElement>('.image-note-editor-root')
    if (!root) return

    setBusy(true)
    setError('')
    rememberCurrentInsertionPoint(root)

    try {
      const file = await captureAndroidCameraPhoto()
      if (!file) return
      sendFileThroughExistingImageInput(root, file)

      const insertToggle = root.querySelector<HTMLButtonElement>('.mobile-editor-dock__insert[aria-expanded="true"]')
      insertToggle?.click()
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'No se pudo insertar la foto en OANIX.')
    } finally {
      setBusy(false)
    }
  }

  function keepEditorSelection(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  return (
    <>
      {insertHost && createPortal(
        <button
          type="button"
          onPointerDown={keepEditorSelection}
          onClick={() => void captureFrom(insertHost)}
          disabled={busy}
          aria-label="Tomar foto con la cámara"
          title="Tomar foto y guardarla cifrada en esta nota"
        >
          <strong>📷</strong><span>{busy ? 'Abriendo cámara…' : 'Cámara'}</span>
        </button>,
        insertHost,
      )}

      {toolbarHost && createPortal(
        <button
          className="editor-tool"
          type="button"
          onPointerDown={keepEditorSelection}
          onClick={() => void captureFrom(toolbarHost)}
          disabled={busy}
          aria-label="Tomar foto con la cámara"
          title="Tomar foto y guardarla cifrada"
        >
          Cámara
        </button>,
        toolbarHost,
      )}

      {error && (
        <aside
          role="alert"
          style={{
            position: 'fixed',
            zIndex: 2800,
            left: '50%',
            bottom: 'max(1rem, env(safe-area-inset-bottom))',
            width: 'min(32rem, calc(100vw - 1rem))',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '.75rem',
            padding: '.75rem .85rem',
            borderRadius: '.85rem',
            background: 'rgba(15,23,42,.96)',
            color: '#eef5ff',
            boxShadow: '0 16px 45px rgba(0,0,0,.3)',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Cerrar error de cámara"
            style={{
              minWidth: '2.25rem',
              minHeight: '2.25rem',
              border: 0,
              borderRadius: '.6rem',
              background: 'rgba(255,255,255,.08)',
              color: 'inherit',
            }}
          >×</button>
        </aside>
      )}
    </>
  )
}
