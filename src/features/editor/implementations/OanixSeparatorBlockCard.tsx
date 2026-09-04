import type { EditorSeparatorBlock } from '../separatorBlockCodec.ts'
import './oanixSeparatorBlockCard.css'

interface OanixSeparatorBlockCardProps {
  block: EditorSeparatorBlock
  disabled: boolean
  onRemove?: () => void | Promise<void>
  onError?: (message: string) => void
}

export function OanixSeparatorBlockCard({ block, disabled, onRemove, onError }: OanixSeparatorBlockCardProps) {
  async function removeSeparator() {
    if (!onRemove || disabled) return
    if (!window.confirm('¿Eliminar este separador?')) return
    try {
      await onRemove()
    } catch {
      onError?.('No se pudo eliminar el separador.')
    }
  }

  return <article
    className="oanix-separator-block"
    data-oanix-element-id={block.id}
    data-oanix-element-kind="separator"
    aria-label="Separador"
  >
    <span className="oanix-separator-block__line" aria-hidden="true" />
    {onRemove && <button
      type="button"
      className="oanix-separator-block__remove"
      disabled={disabled}
      onClick={() => void removeSeparator()}
      aria-label="Eliminar separador"
      title="Eliminar separador"
    >×</button>}
  </article>
}
