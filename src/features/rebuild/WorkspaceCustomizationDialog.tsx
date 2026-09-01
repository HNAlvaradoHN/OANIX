import { useEffect, useState, type FormEvent } from 'react'
import {
  V2_FOLDER_GRADIENTS,
  V2_FOLDER_ICONS,
  type FolderV2Record,
  type TagV2Record,
} from './rebuildModel'
import './workspaceCustomizationDialog.css'

export interface WorkspaceFolderCustomization {
  name: string
  icon: string
  gradientIndex: number
  customColor: string | null
}

export interface WorkspaceTagCustomization {
  name: string
  color: string
}

type WorkspaceCustomizationTarget =
  | { kind: 'folder'; value: FolderV2Record; hasCover: boolean }
  | { kind: 'tag'; value: TagV2Record }

interface WorkspaceCustomizationDialogProps {
  target: WorkspaceCustomizationTarget | null
  busy?: boolean
  onClose: () => void
  onSaveFolder: (folderId: string, input: WorkspaceFolderCustomization) => Promise<boolean>
  onSaveTag: (tagId: string, input: WorkspaceTagCustomization) => Promise<boolean>
  onChooseFolderCover: (folderId: string, file: File) => Promise<boolean>
  onRemoveFolderCover: (folderId: string) => Promise<boolean>
}

export function WorkspaceCustomizationDialog({
  target,
  busy = false,
  onClose,
  onSaveFolder,
  onSaveTag,
  onChooseFolderCover,
  onRemoveFolderCover,
}: WorkspaceCustomizationDialogProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(V2_FOLDER_ICONS[0])
  const [gradientIndex, setGradientIndex] = useState(0)
  const [customColor, setCustomColor] = useState<string | null>(null)
  const [tagColor, setTagColor] = useState('#7c5cff')

  useEffect(() => {
    if (!target) return
    setName(target.value.name)
    if (target.kind === 'folder') {
      setIcon(target.value.icon)
      setGradientIndex(target.value.gradientIndex)
      setCustomColor(target.value.customColor ?? null)
    } else {
      setTagColor(target.value.color)
    }
  }, [target])

  if (!target) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!target || busy) return

    const saved = target.kind === 'folder'
      ? await onSaveFolder(target.value.id, { name, icon, gradientIndex, customColor })
      : await onSaveTag(target.value.id, { name, color: tagColor })
    if (saved) onClose()
  }

  async function chooseCover(file: File | undefined) {
    if (!file || target?.kind !== 'folder' || busy) return
    await onChooseFolderCover(target.value.id, file)
  }

  async function removeCover() {
    if (target?.kind !== 'folder' || busy) return
    await onRemoveFolderCover(target.value.id)
  }

  return (
    <div className="rebuild-modal-host workspace-customization" role="presentation">
      <button
        className="rebuild-modal-backdrop"
        type="button"
        onClick={onClose}
        data-oanix-back-close="true"
        aria-label="Cerrar personalización"
      />
      <section
        className="rebuild-modal workspace-customization__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={target.kind === 'folder' ? 'Personalizar carpeta' : 'Personalizar etiqueta'}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <small>{target.kind === 'folder' ? 'CARPETA' : 'ETIQUETA'}</small>
              <strong>Personalizar</strong>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar">×</button>
          </header>

          <label className="workspace-customization__field">
            <span>Nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={target.kind === 'folder' ? 60 : 40}
              autoFocus
              disabled={busy}
            />
          </label>

          {target.kind === 'folder' ? (
            <>
              <fieldset className="workspace-customization__group">
                <legend>Icono</legend>
                <div className="workspace-customization__icons">
                  {V2_FOLDER_ICONS.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      className={icon === candidate ? 'is-active' : ''}
                      onClick={() => setIcon(candidate)}
                      aria-label={`Usar icono ${candidate}`}
                      aria-pressed={icon === candidate}
                      disabled={busy}
                    >
                      {candidate}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="workspace-customization__group">
                <legend>Marco y color del Inicio</legend>
                <div className="workspace-customization__gradients">
                  {V2_FOLDER_GRADIENTS.map(([from, to], index) => (
                    <button
                      key={`${from}-${to}`}
                      type="button"
                      className={customColor === null && gradientIndex === index ? 'is-active' : ''}
                      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                      onClick={() => {
                        setGradientIndex(index)
                        setCustomColor(null)
                      }}
                      aria-label={`Usar degradado ${index + 1}`}
                      aria-pressed={customColor === null && gradientIndex === index}
                      disabled={busy}
                    />
                  ))}
                </div>
                <label className="workspace-customization__color">
                  <span>Color personalizado</span>
                  <input
                    type="color"
                    value={customColor ?? V2_FOLDER_GRADIENTS[gradientIndex][0]}
                    onChange={(event) => setCustomColor(event.target.value)}
                    disabled={busy}
                  />
                </label>
              </fieldset>

              <fieldset className="workspace-customization__group">
                <legend>Fondo de la carpeta</legend>
                <div className="workspace-customization__cover-actions">
                  <label className="workspace-customization__file">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.currentTarget.value = ''
                        void chooseCover(file)
                      }}
                      disabled={busy}
                    />
                    <span>{target.hasCover ? 'Cambiar imagen' : 'Elegir imagen'}</span>
                  </label>
                  {target.hasCover && (
                    <button type="button" onClick={() => void removeCover()} disabled={busy}>
                      Quitar fondo
                    </button>
                  )}
                </div>
                <small>La imagen se entrega al motor de OANIX; esta plantilla no la almacena por su cuenta.</small>
              </fieldset>
            </>
          ) : (
            <label className="workspace-customization__field workspace-customization__color">
              <span>Color de la etiqueta</span>
              <input
                type="color"
                value={tagColor}
                onChange={(event) => setTagColor(event.target.value)}
                disabled={busy}
              />
            </label>
          )}

          <footer>
            <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
