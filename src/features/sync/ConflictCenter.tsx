import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  isBinaryImageConflictSide,
  loadImageConflictVisuals,
  resolveSyncConflict,
  scanSyncConflicts,
  type SyncConflictResolutionChoice,
  type SyncConflictSide,
  type SyncConflictView,
} from './conflictCoordinator'
import { isNoteRecord, noteBlocksToPlainText } from '../notes/noteTypes'
import './conflictCenter.css'

interface ConflictCenterProps {
  onResolved: () => void
}

interface SyncStatusDetail {
  kind?: string
}

interface ImageVisualState {
  loading: boolean
  localUrl: string | null
  remoteUrl: string | null
  error: string
}

const EMPTY_IMAGE_VISUALS: ImageVisualState = {
  loading: false,
  localUrl: null,
  remoteUrl: null,
  error: '',
}

function sidePreview(side: SyncConflictSide): { title: string; body: string } {
  if (side.deleted) {
    return {
      title: 'Eliminada',
      body: 'Esta versión indica que el registro fue eliminado.',
    }
  }

  if (isNoteRecord(side.value)) {
    const body = noteBlocksToPlainText(side.value.content.blocks)
    return {
      title: side.value.title || 'Nota sin título',
      body: body || 'Nota sin contenido de texto visible.',
    }
  }

  if (isBinaryImageConflictSide(side.value)) {
    return {
      title: 'Imagen original',
      body: 'Copia cifrada disponible. La vista se descifra únicamente en memoria para esta comparación.',
    }
  }

  if (side.value === null || side.value === undefined) {
    return {
      title: 'Sin vista previa',
      body: 'No se pudo preparar una vista previa de esta versión.',
    }
  }

  try {
    return {
      title: 'Registro cifrado',
      body: JSON.stringify(side.value, null, 2),
    }
  } catch {
    return {
      title: 'Registro cifrado',
      body: 'El contenido está disponible, pero no puede mostrarse como texto.',
    }
  }
}

export function ConflictCenter({ onResolved }: ConflictCenterProps) {
  const [conflicts, setConflicts] = useState<SyncConflictView[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [busyChoice, setBusyChoice] = useState<SyncConflictResolutionChoice | null>(null)
  const [message, setMessage] = useState('')
  const [imageVisuals, setImageVisuals] = useState<ImageVisualState>(EMPTY_IMAGE_VISUALS)

  const refresh = useCallback(async (showErrors = false) => {
    try {
      const next = await scanSyncConflicts()
      setConflicts(next)
      setActiveIndex((current) => Math.min(current, Math.max(0, next.length - 1)))
      if (next.length === 0) setOpen(false)
      if (showErrors) setMessage('')
    } catch (error) {
      if (showErrors) {
        setMessage(error instanceof Error ? error.message : 'No se pudieron comprobar los conflictos de sincronización.')
      }
    }
  }, [])

  useEffect(() => {
    void refresh(false)

    const handleSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatusDetail>).detail
      if (detail?.kind === 'conflict' || detail?.kind === 'synced') void refresh(false)
    }
    const handleResolved = () => void refresh(false)

    window.addEventListener('oanix:sync-status', handleSyncStatus)
    window.addEventListener('oanix:conflict-resolved', handleResolved)
    return () => {
      window.removeEventListener('oanix:sync-status', handleSyncStatus)
      window.removeEventListener('oanix:conflict-resolved', handleResolved)
    }
  }, [refresh])

  const active = conflicts[activeIndex] ?? null
  const remotePreview = useMemo(() => active ? sidePreview(active.remote) : null, [active])
  const localPreview = useMemo(() => active ? sidePreview(active.local) : null, [active])

  useEffect(() => {
    let disposed = false
    const objectUrls: string[] = []

    if (!open || !active || active.recordType !== 'image') {
      setImageVisuals(EMPTY_IMAGE_VISUALS)
      return () => undefined
    }

    setImageVisuals({ loading: true, localUrl: null, remoteUrl: null, error: '' })
    void loadImageConflictVisuals(active.localKey, active.token)
      .then((visuals) => {
        if (disposed || !visuals) return
        const localUrl = visuals.local ? URL.createObjectURL(visuals.local) : null
        const remoteUrl = visuals.remote ? URL.createObjectURL(visuals.remote) : null
        if (localUrl) objectUrls.push(localUrl)
        if (remoteUrl) objectUrls.push(remoteUrl)
        setImageVisuals({ loading: false, localUrl, remoteUrl, error: '' })
      })
      .catch((error) => {
        if (disposed) return
        setImageVisuals({
          loading: false,
          localUrl: null,
          remoteUrl: null,
          error: error instanceof Error ? error.message : 'No se pudieron descifrar las vistas de esta imagen.',
        })
      })

    return () => {
      disposed = true
      for (const url of objectUrls) URL.revokeObjectURL(url)
    }
  }, [open, active?.localKey, active?.token, active?.recordType])

  async function handleResolve(choice: SyncConflictResolutionChoice) {
    if (!active || busyChoice || !active.resolvable) return
    if (choice === 'combine' && !active.canCombine) return

    setBusyChoice(choice)
    setMessage('')
    try {
      await resolveSyncConflict(active.localKey, active.token, choice)
      onResolved()
      await refresh(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo resolver este conflicto.')
      await refresh(false)
    } finally {
      setBusyChoice(null)
    }
  }

  function renderConflictBody(side: 'remote' | 'local', preview: { title: string; body: string }) {
    if (!active || active.recordType !== 'image') return <pre>{preview.body}</pre>
    const conflictSide = side === 'remote' ? active.remote : active.local
    if (conflictSide.deleted) return <pre>{preview.body}</pre>
    if (imageVisuals.loading) {
      return <div className="conflict-image-preview conflict-image-preview--status">Descifrando imagen en memoria…</div>
    }
    const url = side === 'remote' ? imageVisuals.remoteUrl : imageVisuals.localUrl
    if (url) {
      return (
        <div className="conflict-image-preview">
          <img src={url} alt={`Vista de la versión ${side === 'remote' ? 'sincronizada' : 'local'}`} />
        </div>
      )
    }
    return (
      <div className="conflict-image-preview conflict-image-preview--status">
        {imageVisuals.error || preview.body}
      </div>
    )
  }

  if (conflicts.length === 0) return null

  return (
    <>
      <aside className="conflict-banner" role="status" aria-live="polite">
        <div>
          <strong>⚠ {conflicts.length} conflicto{conflicts.length === 1 ? '' : 's'} de sincronización</strong>
          <span>OANIX conservó ambas versiones y no sobrescribió nada.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage('')
            setOpen(true)
          }}
        >
          Revisar
        </button>
      </aside>

      {open && active && remotePreview && localPreview && (
        <div className="conflict-overlay" role="presentation">
          <section
            className="conflict-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="conflict-dialog-title"
          >
            <header className="conflict-dialog__header">
              <div>
                <span className="conflict-dialog__eyebrow">
                  V2 · Resolución de conflictos · {activeIndex + 1}/{conflicts.length}
                </span>
                <h2 id="conflict-dialog-title">{active.label}</h2>
                <p>
                  Dos dispositivos cambiaron este registro antes de ponerse de acuerdo.
                  OANIX no elegirá por vos.
                </p>
              </div>
              <button
                className="conflict-dialog__close"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar resolución de conflictos"
                disabled={busyChoice !== null}
              >
                ×
              </button>
            </header>

            {!active.resolvable && (
              <div className="conflict-dialog__warning" role="alert">
                <strong>Este conflicto necesita revisión manual.</strong>
                <span>{active.reason}</span>
              </div>
            )}

            <div className="conflict-grid">
              <article className="conflict-side conflict-side--remote">
                <div className="conflict-side__heading">
                  <span>Primera en sincronizarse</span>
                  <small>Versión ya aceptada por la sincronización remota</small>
                </div>
                <h3>{remotePreview.title}</h3>
                {renderConflictBody('remote', remotePreview)}
                <button
                  type="button"
                  onClick={() => void handleResolve('remote')}
                  disabled={!active.resolvable || busyChoice !== null}
                >
                  {busyChoice === 'remote' ? 'Aplicando…' : 'Usar esta versión'}
                </button>
              </article>

              <article className="conflict-side conflict-side--local">
                <div className="conflict-side__heading">
                  <span>Este dispositivo</span>
                  <small>Versión local que todavía no reemplazó la remota</small>
                </div>
                <h3>{localPreview.title}</h3>
                {renderConflictBody('local', localPreview)}
                <button
                  type="button"
                  onClick={() => void handleResolve('local')}
                  disabled={!active.resolvable || busyChoice !== null}
                >
                  {busyChoice === 'local' ? 'Aplicando…' : 'Usar esta versión'}
                </button>
              </article>
            </div>

            <div className="conflict-combine">
              <button
                type="button"
                onClick={() => void handleResolve('combine')}
                disabled={!active.resolvable || !active.canCombine || busyChoice !== null}
              >
                {busyChoice === 'combine' ? 'Combinando…' : 'Combinar ambas'}
              </button>
              <p>{active.combineReason}</p>
            </div>

            {message && <p className="conflict-dialog__message" role="alert">{message}</p>}

            <footer className="conflict-dialog__footer">
              <button
                type="button"
                onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}
                disabled={activeIndex === 0 || busyChoice !== null}
              >
                ← Anterior
              </button>
              <span>
                {active.recordType === 'image'
                  ? 'Las imágenes originales se eligen, no se mezclan. El preview se regenerará desde la imagen elegida.'
                  : 'Al combinar, OANIX conserva primero la versión sincronizada y debajo la de este dispositivo.'}
              </span>
              <button
                type="button"
                onClick={() => setActiveIndex((value) => Math.min(conflicts.length - 1, value + 1))}
                disabled={activeIndex >= conflicts.length - 1 || busyChoice !== null}
              >
                Siguiente →
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
