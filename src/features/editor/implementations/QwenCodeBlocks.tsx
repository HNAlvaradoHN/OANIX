import { useEffect, useState } from 'react'
import {
  CODE_BLOCK_KIND,
  MAX_CODE_BLOCK_LANGUAGE_LENGTH,
  MAX_CODE_BLOCK_TEXT_LENGTH,
  decodeCodeBlock,
  encodeCodeBlock,
  type EditorCodeBlock,
} from '../codeBlockCodec.ts'
import type { EditorBlockSession } from '../editorBlockSession.ts'
import './qwenCodeBlocks.css'

interface QwenCodeBlocksProps {
  session: EditorBlockSession
  disabled: boolean
  onActivity: () => void
}

function newCodeBlockId(): string {
  return `code-${crypto.randomUUID()}`
}

export function QwenCodeBlocks({
  session,
  disabled,
  onActivity,
}: QwenCodeBlocksProps) {
  const [blocks, setBlocks] = useState<EditorCodeBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void session.load()
      .then((loaded) => {
        if (!active) return
        setBlocks(
          loaded.flatMap((block) => {
            const decoded = decodeCodeBlock(block)
            return decoded ? [decoded] : []
          }),
        )
        setError('')
      })
      .catch(() => {
        if (active) setError('No se pudieron abrir los bloques de código de esta nota.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session])

  function queueBlock(next: EditorCodeBlock) {
    setBlocks((current) => current.map((block) => block.id === next.id ? next : block))
    onActivity()
    void session.upsert(encodeCodeBlock(next)).catch(() => {
      setError('No se pudo preparar el cambio del bloque de código.')
    })
  }

  function addCodeBlock() {
    const next: EditorCodeBlock = {
      id: newCodeBlockId(),
      kind: CODE_BLOCK_KIND,
      text: '',
      language: '',
    }
    setBlocks((current) => [...current, next])
    onActivity()
    void session.upsert(encodeCodeBlock(next)).catch(() => {
      setError('No se pudo preparar el bloque de código nuevo.')
    })
  }

  function removeCodeBlock(blockId: string) {
    setBlocks((current) => current.filter((block) => block.id !== blockId))
    onActivity()
    void session.remove(blockId).catch(() => {
      setError('No se pudo preparar la eliminación del bloque de código.')
    })
  }

  return (
    <section className="oanix-qwen-sheet__code-blocks" aria-label="Bloques de código de la nota">
      <div className="oanix-qwen-sheet__blocks-heading">
        <div>
          <span className="oanix-qwen-sheet__blocks-kicker">Bloques</span>
          <strong>Código</strong>
        </div>
        <button
          type="button"
          className="oanix-qwen-sheet__add-code-block"
          disabled={disabled || loading}
          onClick={addCodeBlock}
        >
          + Código
        </button>
      </div>

      {loading && (
        <p className="oanix-qwen-sheet__blocks-hint" role="status">
          Abriendo bloques cifrados…
        </p>
      )}

      {error && (
        <p className="oanix-qwen-sheet__blocks-error" role="alert">
          {error}
        </p>
      )}

      {!loading && blocks.length === 0 && (
        <p className="oanix-qwen-sheet__blocks-hint">
          Añade fragmentos técnicos sin mezclarlos con el cuerpo principal de la nota.
        </p>
      )}

      <div className="oanix-qwen-sheet__code-stack">
        {blocks.map((block) => (
          <article className="oanix-qwen-sheet__code-block" key={block.id}>
            <div className="oanix-qwen-sheet__code-topline">
              <input
                type="text"
                value={block.language}
                maxLength={MAX_CODE_BLOCK_LANGUAGE_LENGTH}
                disabled={disabled}
                placeholder="Lenguaje (opcional)"
                aria-label="Lenguaje del bloque de código"
                onChange={(event) => queueBlock({
                  ...block,
                  language: event.target.value,
                })}
              />
              <button
                type="button"
                className="oanix-qwen-sheet__code-remove"
                disabled={disabled}
                onClick={() => removeCodeBlock(block.id)}
                aria-label="Eliminar bloque de código"
              >
                Eliminar
              </button>
            </div>

            <textarea
              value={block.text}
              maxLength={MAX_CODE_BLOCK_TEXT_LENGTH}
              disabled={disabled}
              spellCheck={false}
              wrap="off"
              placeholder="Escribe o pega código…"
              aria-label="Contenido del bloque de código"
              onChange={(event) => queueBlock({
                ...block,
                text: event.target.value,
              })}
            />
          </article>
        ))}
      </div>
    </section>
  )
}
