import { useEffect, useRef, useState } from 'react'
import { OanixIcon } from '../../shared/OanixIcon'
import './noteEditor.css'
import './sheets/ruledSheet.css'

export interface NoteEditorSnapshot {
  title: string
  text: string
}

interface NoteEditorProps {
  noteId: string
  initialTitle: string
  initialText: string
  saving: boolean
  error?: string
  onRequestClose: (snapshot: NoteEditorSnapshot | null) => Promise<boolean>
  onActivity?: () => void
}

/**
 * Editing stays local to this component. The large note body is intentionally uncontrolled:
 * ordinary keystrokes never copy the complete text into React state or re-render the Home shell.
 * A full snapshot is read only at a save boundary.
 */
export function NoteEditor({
  noteId,
  initialTitle,
  initialText,
  saving,
  error = '',
  onRequestClose,
  onActivity,
}: NoteEditorProps) {
  const titleRef = useRef<HTMLInputElement | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const dirtyRef = useRef(false)
  const [dirty, setDirty] = useState(false)

  function markActivity() {
    onActivity?.()
    if (dirtyRef.current) return

    dirtyRef.current = true
    setDirty(true)
  }

  useEffect(() => {
    if (!dirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  async function requestClose() {
    if (saving) return

    if (!dirtyRef.current) {
      await onRequestClose(null)
      return
    }

    const snapshot: NoteEditorSnapshot = {
      title: titleRef.current?.value ?? initialTitle,
      text: textRef.current?.value ?? initialText,
    }

    await onRequestClose(snapshot)
  }

  return (
    <section
      className="oanix-note-editor"
      aria-label="Editor de nota"
      aria-busy={saving}
      data-oanix-note-id={noteId}
      data-oanix-unsaved={dirty ? 'true' : 'false'}
    >
      <header className="oanix-note-editor__header">
        <button
          type="button"
          className="rebuild-icon-button oanix-note-editor__back"
          data-oanix-back-close="true"
          data-oanix-save-and-close="true"
          onClick={() => void requestClose()}
          aria-label="Guardar y volver"
          disabled={saving}
        >
          <OanixIcon name="back" />
        </button>

        <input
          ref={titleRef}
          className="oanix-note-editor__title"
          defaultValue={initialTitle}
          onInput={markActivity}
          maxLength={160}
          aria-label="Título de la nota"
          autoComplete="off"
        />
      </header>

      {error && <div className="oanix-note-editor__error" role="alert">{error}</div>}

      <div className="oanix-note-editor__sheet" data-oanix-sheet="ruled-v1">
        <textarea
          ref={textRef}
          className="oanix-note-editor__body"
          defaultValue={initialText}
          onInput={markActivity}
          onCompositionStart={onActivity}
          onCompositionEnd={onActivity}
          placeholder="Empieza a escribir…"
          aria-label="Contenido de la nota"
          autoFocus
          spellCheck
          wrap="soft"
        />
      </div>
    </section>
  )
}
