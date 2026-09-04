import { useEffect, useRef, useState } from 'react'
import {
  MAX_CODE_BLOCK_LANGUAGE_LENGTH,
  MAX_CODE_BLOCK_TEXT_LENGTH,
  encodeCodeBlock,
  type EditorCodeBlock,
} from '../codeBlockCodec.ts'
import type { EditorSurfaceBlock } from '../editorSurfaceContract.ts'
import './oanixCodeBlockCard.css'

const CODE_LANGUAGE_OPTIONS = [
  ['plaintext', 'Texto plano'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['python', 'Python'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['json', 'JSON'],
  ['bash', 'Bash'],
  ['sql', 'SQL'],
  ['java', 'Java'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['kotlin', 'Kotlin'],
  ['swift', 'Swift'],
  ['php', 'PHP'],
] as const

interface OanixCodeBlockCardProps {
  block: EditorCodeBlock
  disabled: boolean
  onChange: (block: EditorSurfaceBlock) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  onActivity: () => void
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onError?: (message: string) => void
}

export function OanixCodeBlockCard({
  block,
  disabled,
  onChange,
  onRemove,
  onActivity,
  onCompositionStart,
  onCompositionEnd,
  onError,
}: OanixCodeBlockCardProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const textRef = useRef(block.text)
  const languageRef = useRef(block.language)
  const knownLanguage = CODE_LANGUAGE_OPTIONS.some(([value]) => value === block.language)
  if (!knownLanguage && languageRef.current === block.language) languageRef.current = 'plaintext'

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [expanded])

  function queue() {
    onActivity()
    const next: EditorCodeBlock = {
      ...block,
      text: textRef.current,
      language: languageRef.current,
    }
    void Promise.resolve(onChange(encodeCodeBlock(next))).catch(() => {
      onError?.('No se pudo preparar el cambio del bloque de código.')
    })
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(textRef.current)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_200)
    } catch {
      onError?.('No se pudo copiar el código al portapapeles.')
    }
  }

  async function removeCode() {
    if (!onRemove || disabled) return
    if (!window.confirm('¿Eliminar este bloque de código?')) return
    try {
      await onRemove()
    } catch {
      onError?.('No se pudo eliminar el bloque de código.')
    }
  }

  const languageLabel = CODE_LANGUAGE_OPTIONS.find(([value]) => value === languageRef.current)?.[1] ?? 'Texto plano'

  return <>
    <article className="oanix-code-block" data-oanix-element-id={block.id} data-oanix-element-kind="code">
      <header className="oanix-code-block__header">
        <div className="oanix-code-block__identity"><span aria-hidden="true">&lt;/&gt;</span><strong>Código</strong></div>
        <div className="oanix-code-block__actions">
          <button type="button" onClick={() => setExpanded(true)} aria-label="Abrir código en pantalla completa" title="Pantalla completa">⛶</button>
          <button type="button" disabled={disabled} onClick={() => void copyCode()} aria-label="Copiar código">{copied ? 'Copiado' : 'Copiar'}</button>
          {onRemove && <button type="button" className="is-danger" disabled={disabled} onClick={() => void removeCode()} aria-label="Eliminar bloque de código">Eliminar</button>}
        </div>
      </header>
      <label className="oanix-code-block__language">
        <span>Lenguaje</span>
        <select
          defaultValue={knownLanguage ? block.language : 'plaintext'}
          disabled={disabled}
          aria-label="Lenguaje del bloque de código"
          onChange={(event) => {
            languageRef.current = event.target.value.slice(0, MAX_CODE_BLOCK_LANGUAGE_LENGTH)
            queue()
          }}
        >
          {CODE_LANGUAGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <textarea
        className="oanix-code-block__editor"
        data-oanix-primary-input="true"
        defaultValue={block.text}
        maxLength={MAX_CODE_BLOCK_TEXT_LENGTH}
        disabled={disabled}
        spellCheck={false}
        wrap="off"
        placeholder="Escribe o pega código…"
        aria-label="Contenido del bloque de código"
        onInput={(event) => {
          textRef.current = event.currentTarget.value
          queue()
        }}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      />
    </article>

    {expanded && <div
      className="oanix-code-block__fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label="Código en pantalla completa"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setExpanded(false)
      }}
    >
      <section className="oanix-code-block__fullscreen-panel">
        <header className="oanix-code-block__fullscreen-header">
          <div>
            <strong>Código</strong>
            <small>{languageLabel}</small>
          </div>
          <div className="oanix-code-block__fullscreen-actions">
            <button type="button" onClick={() => void copyCode()}>{copied ? 'Copiado' : 'Copiar'}</button>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Cerrar pantalla completa">✕</button>
          </div>
        </header>
        <pre className="oanix-code-block__fullscreen-content">{textRef.current || 'Sin contenido.'}</pre>
      </section>
    </div>}
  </>
}
