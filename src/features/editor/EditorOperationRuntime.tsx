import { useEffect } from 'react'
import './editorOperationPolish.css'

const FEEDBACK_ID = 'oanix-editor-operation-feedback'
const MIN_VISIBLE_MS = 360
const IMAGE_TIMEOUT_MS = 45_000

interface FeedbackController {
  close: () => void
  update: (title: string, detail: string) => void
}

function feedbackElement(): HTMLElement | null {
  return document.getElementById(FEEDBACK_ID)
}

function showFeedback(title: string, detail: string): FeedbackController {
  feedbackElement()?.remove()

  const startedAt = performance.now()
  const backdrop = document.createElement('div')
  backdrop.id = FEEDBACK_ID
  backdrop.setAttribute('role', 'status')
  backdrop.setAttribute('aria-live', 'assertive')
  backdrop.setAttribute('aria-busy', 'true')

  const panel = document.createElement('div')
  panel.className = 'oanix-editor-operation-feedback__panel'

  const spinner = document.createElement('span')
  spinner.className = 'oanix-editor-operation-feedback__spinner'
  spinner.setAttribute('aria-hidden', 'true')

  const copy = document.createElement('div')
  copy.className = 'oanix-editor-operation-feedback__copy'

  const heading = document.createElement('strong')
  const description = document.createElement('span')
  heading.textContent = title
  description.textContent = detail

  copy.append(heading, description)
  panel.append(spinner, copy)
  backdrop.append(panel)
  document.body.append(backdrop)

  let closed = false
  const remove = () => {
    if (closed) return
    closed = true
    backdrop.remove()
  }

  return {
    close() {
      const elapsed = performance.now() - startedAt
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
      window.setTimeout(remove, remaining)
    },
    update(nextTitle, nextDetail) {
      heading.textContent = nextTitle
      description.textContent = nextDetail
    },
  }
}

function rangeInside(content: HTMLElement): Range {
  const selection = document.getSelection()
  if (selection && selection.rangeCount > 0) {
    const current = selection.getRangeAt(0)
    const ancestor = current.commonAncestorContainer
    if (content === ancestor || content.contains(ancestor)) {
      return current.cloneRange()
    }
  }

  const range = document.createRange()
  range.selectNodeContents(content)
  range.collapse(false)
  return range
}

function insertPlainText(content: HTMLElement, text: string, range: Range) {
  range.deleteContents()
  const textNode = document.createTextNode(text)
  range.insertNode(textNode)
  range.setStartAfter(textNode)
  range.collapse(true)

  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  content.focus({ preventScroll: true })
}

function isHeavyCodePaste(text: string): boolean {
  if (text.length >= 1_500) return true
  let lines = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) lines += 1
    if (lines >= 24) return true
  }
  return false
}

function imageCount(root: Element): number {
  return root.querySelectorAll('[data-image-block="true"]').length
}

function watchImageOperation(root: Element, expectedIncrease: number, feedback: FeedbackController) {
  const initialCount = imageCount(root)
  let finished = false

  const finish = () => {
    if (finished) return
    finished = true
    observer.disconnect()
    window.clearTimeout(timeout)
    feedback.close()
  }

  const check = () => {
    const error = root.querySelector<HTMLElement>('.image-note-editor__error')
    if (error?.textContent?.trim()) {
      feedback.update('No se pudo completar la imagen', error.textContent.trim())
      window.setTimeout(finish, 900)
      return
    }

    if (imageCount(root) >= initialCount + expectedIncrease) finish()
  }

  const observer = new MutationObserver(check)
  observer.observe(root, { childList: true, subtree: true, characterData: true })

  const timeout = window.setTimeout(() => {
    feedback.update('La imagen está tardando más de lo normal', 'OANIX sigue esperando que termine el procesamiento local.')
    window.setTimeout(finish, 2_000)
  }, IMAGE_TIMEOUT_MS)

  check()
}

export function EditorOperationRuntime() {
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const editorRoot = target.closest('.image-note-editor-root')
      if (!editorRoot) return

      const imageFiles = Array.from(event.clipboardData?.files ?? [])
        .filter((file) => file.type.startsWith('image/'))
      if (imageFiles.length > 0) {
        const feedback = showFeedback(
          imageFiles.length === 1 ? 'Procesando y cifrando imagen…' : `Procesando ${imageFiles.length} imágenes…`,
          'La imagen aparecerá en la nota cuando el guardado local termine.',
        )
        watchImageOperation(editorRoot, imageFiles.length, feedback)
        return
      }

      const codeContent = target.closest<HTMLElement>('[data-code-content="true"]')
      if (!codeContent || !editorRoot.contains(codeContent)) return

      const plainText = event.clipboardData?.getData('text/plain') ?? ''
      if (!plainText) return

      const range = rangeInside(codeContent)
      const heavy = isHeavyCodePaste(plainText)

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      if (!heavy) {
        insertPlainText(codeContent, plainText, range)
        codeContent.dispatchEvent(new Event('input', { bubbles: true }))
        return
      }

      const lineCount = Math.max(1, plainText.split('\n').length)
      const feedback = showFeedback(
        'Pegando código…',
        `${lineCount} líneas · preparando el bloque sin congelar la pantalla.`,
      )

      window.requestAnimationFrame(() => {
        insertPlainText(codeContent, plainText, range)

        // Let the browser paint the pasted text before RichTextEditor reparses the
        // complete note model. The model sync still runs immediately afterwards.
        window.setTimeout(() => {
          try {
            codeContent.dispatchEvent(new Event('input', { bubbles: true }))
          } finally {
            feedback.update('Código pegado', 'Sincronizando los cambios de la nota…')
            feedback.close()
          }
        }, 0)
      })
    }

    function handleFileChange(event: Event) {
      const input = event.target
      if (!(input instanceof HTMLInputElement) || !input.matches('.image-note-editor__input')) return
      const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith('image/'))
      if (files.length === 0) return
      const editorRoot = input.closest('.image-note-editor-root')
      if (!editorRoot) return

      const feedback = showFeedback(
        files.length === 1 ? 'Procesando y cifrando imagen…' : `Procesando ${files.length} imágenes…`,
        'Comprimiendo y guardando localmente. No cierres la nota todavía.',
      )
      watchImageOperation(editorRoot, files.length, feedback)
    }

    document.addEventListener('paste', handlePaste, true)
    document.addEventListener('change', handleFileChange, true)
    return () => {
      document.removeEventListener('paste', handlePaste, true)
      document.removeEventListener('change', handleFileChange, true)
      feedbackElement()?.remove()
    }
  }, [])

  return null
}
