export type NotebookPaperMode = 'plain' | 'ruled'

export const NOTEBOOK_PAPER_STORAGE_KEY = 'oanix.paper.mode'
export const NOTEBOOK_PAPER_CHANGE_EVENT = 'oanix:paper-mode-change'
export const DEFAULT_NOTEBOOK_PAPER_MODE: NotebookPaperMode = 'plain'

export function normalizeNotebookPaperMode(value: unknown): NotebookPaperMode {
  return value === 'ruled' ? 'ruled' : 'plain'
}

export function readNotebookPaperMode(): NotebookPaperMode {
  try {
    return normalizeNotebookPaperMode(window.localStorage.getItem(NOTEBOOK_PAPER_STORAGE_KEY))
  } catch {
    return DEFAULT_NOTEBOOK_PAPER_MODE
  }
}

export function applyNotebookPaperMode(mode: NotebookPaperMode, notify = true): NotebookPaperMode {
  const next = normalizeNotebookPaperMode(mode)
  const root = document.documentElement
  root.classList.toggle('oanix-paper-ruled', next === 'ruled')
  root.classList.toggle('oanix-paper-plain', next === 'plain')
  if (notify) window.dispatchEvent(new CustomEvent(NOTEBOOK_PAPER_CHANGE_EVENT, { detail: next }))
  return next
}

export function saveNotebookPaperMode(mode: NotebookPaperMode): NotebookPaperMode {
  const next = normalizeNotebookPaperMode(mode)
  try {
    window.localStorage.setItem(NOTEBOOK_PAPER_STORAGE_KEY, next)
  } catch {
    // A blocked storage preference must never block note editing.
  }
  return applyNotebookPaperMode(next)
}
