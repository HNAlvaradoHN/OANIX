import { usesSinglePaneLayout } from '../../shared/responsiveLayout'

type OanixHistoryState = Record<string, unknown> & {
  oanixView?: 'list' | 'note'
  noteId?: string
}

function mobileSinglePane(): boolean {
  const width = window.visualViewport?.width ?? window.innerWidth
  return usesSinglePaneLayout(width)
}

function historyState(value: unknown): OanixHistoryState {
  return value && typeof value === 'object' ? value as OanixHistoryState : {}
}

function noteIdFromState(value: unknown): string | null {
  const state = historyState(value)
  return state.oanixView === 'note' && typeof state.noteId === 'string'
    ? state.noteId
    : null
}

function deepestActiveElement(): Element | null {
  let active: Element | null = document.activeElement
  while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement
  }
  return active
}

function editableElement(): HTMLElement | null {
  const active = deepestActiveElement()
  if (!(active instanceof HTMLElement)) return null
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
    return active
  }
  return active.isContentEditable ? active : null
}

export function blurFocusedMobileEditor(): boolean {
  const focusedEditor = editableElement()
  if (!focusedEditor) return false
  focusedEditor.blur()
  return true
}

let lastOpenNoteId = noteIdFromState(window.history.state)

const originalPushState = window.history.pushState.bind(window.history)
const originalReplaceState = window.history.replaceState.bind(window.history)

window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
  const noteId = noteIdFromState(data)
  if (noteId) lastOpenNoteId = noteId
  originalPushState(data, unused, url)
}) as History['pushState']

window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
  const noteId = noteIdFromState(data)
  if (noteId) lastOpenNoteId = noteId
  originalReplaceState(data, unused, url)
}) as History['replaceState']

window.addEventListener('popstate', (event) => {
  if (!mobileSinglePane()) return

  const nextState = historyState(event.state)
  const nextNoteId = noteIdFromState(nextState)
  if (nextNoteId) {
    lastOpenNoteId = nextNoteId
    return
  }

  if (nextState.oanixView !== 'list') return
  if (!document.querySelector('.notes-shell--open')) return

  if (!lastOpenNoteId || !editableElement()) return

  event.stopImmediatePropagation()
  blurFocusedMobileEditor()
  originalPushState(
    { ...nextState, oanixView: 'note', noteId: lastOpenNoteId },
    '',
    window.location.href,
  )
})
