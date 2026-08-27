import { useEffect } from 'react'
import './noteCreationFeedback.css'

const CREATE_BUTTON_SELECTOR = '.notes-create-fab, .notes-empty .empty-action'
const EMPTY_CREATE_BUTTON_SELECTOR = '.notes-empty .empty-action'
const FEEDBACK_SURFACE_SELECTOR = `${CREATE_BUTTON_SELECTOR}, .notes-error, .note-save-error`
const FEEDBACK_ID = 'oanix-note-create-feedback'

function isCreateButton(button: HTMLButtonElement): boolean {
  const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLocaleLowerCase()
  return label.includes('crear') || label.includes('nueva nota') || label.includes('creando')
}

function mutationTouchesFeedbackSurface(record: MutationRecord): boolean {
  if (record.type === 'attributes') {
    return record.target instanceof Element && record.target.matches(CREATE_BUTTON_SELECTOR)
  }

  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
  return nodes.some((node) => {
    if (!(node instanceof Element)) return false
    return node.matches(FEEDBACK_SURFACE_SELECTOR) || node.querySelector(FEEDBACK_SURFACE_SELECTOR) !== null
  })
}

function createFeedback() {
  if (document.getElementById(FEEDBACK_ID)) return

  const root = document.createElement('div')
  root.id = FEEDBACK_ID
  root.setAttribute('role', 'status')
  root.setAttribute('aria-live', 'polite')
  root.setAttribute('aria-label', 'Creando nota cifrada')

  const panel = document.createElement('div')
  panel.className = 'oanix-note-create-feedback__panel'

  const spinner = document.createElement('span')
  spinner.className = 'oanix-note-create-feedback__spinner'
  spinner.setAttribute('aria-hidden', 'true')

  const copy = document.createElement('span')
  copy.className = 'oanix-note-create-feedback__copy'
  const title = document.createElement('strong')
  title.textContent = 'Creando nota…'
  const detail = document.createElement('small')
  detail.textContent = 'Preparando y guardando la nueva nota cifrada'
  copy.append(title, detail)

  panel.append(spinner, copy)
  root.append(panel)
  document.body.append(root)
}

function removeFeedback() {
  document.getElementById(FEEDBACK_ID)?.remove()
}

export function NoteCreationFeedbackRuntime() {
  useEffect(() => {
    let startedAt = 0
    let sawBusyState = false
    let timeout = 0

    const stop = () => {
      window.clearTimeout(timeout)
      startedAt = 0
      sawBusyState = false
      removeFeedback()
    }

    const scheduleSafetyTimeout = () => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(stop, 10000)
    }

    const sync = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(CREATE_BUTTON_SELECTOR))
        .filter(isCreateButton)
      const busy = buttons.some((button) => button.disabled && /creando/i.test(button.textContent ?? ''))

      if (busy && !document.getElementById(FEEDBACK_ID)) {
        startedAt = Date.now()
        sawBusyState = true
        createFeedback()
        scheduleSafetyTimeout()
      } else if (busy) {
        sawBusyState = true
      }

      if (!document.getElementById(FEEDBACK_ID)) return

      if (document.documentElement.classList.contains('oanix-note-detail-open')) {
        stop()
        return
      }

      const hasError = document.querySelector('.notes-error, .note-save-error') !== null
      if (hasError && Date.now() - startedAt > 250) {
        stop()
        return
      }

      if (sawBusyState && !busy && Date.now() - startedAt > 250) stop()
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>(EMPTY_CREATE_BUTTON_SELECTOR)
        : null
      if (!target || target.disabled || !isCreateButton(target)) return

      startedAt = Date.now()
      sawBusyState = false
      createFeedback()
      scheduleSafetyTimeout()
      requestAnimationFrame(sync)
    }

    document.addEventListener('click', onClick, true)

    const detailObserver = new MutationObserver(sync)
    detailObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    const workspace = document.querySelector<HTMLElement>('.notes-shell')
    const observedWorkspace = workspace ?? undefined
    const workspaceObserver = observedWorkspace
      ? new MutationObserver((records) => {
          if (records.some(mutationTouchesFeedbackSurface)) sync()
        })
      : null
    if (observedWorkspace && workspaceObserver) {
      workspaceObserver.observe(observedWorkspace, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled'],
      })
    }

    return () => {
      document.removeEventListener('click', onClick, true)
      detailObserver.disconnect()
      workspaceObserver?.disconnect()
      stop()
    }
  }, [])

  return null
}
