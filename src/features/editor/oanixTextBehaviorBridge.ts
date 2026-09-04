import type { EditorSurfaceProps } from './editorSurfaceContract.ts'
import { buildHeadingEnterPlan, buildHeadingParagraphReset } from './oanixHeadingEnterPlan.ts'

interface InstallOptions {
  noteId: string
  loadBlocks?: EditorSurfaceProps['loadBlocks']
  onRequestBlockSave?: EditorSurfaceProps['onRequestBlockSave']
  onRefresh: () => void
}

interface PendingVisualState {
  scrollTop: number
  pageScrollX: number
  pageScrollY: number
  theme: string
  modeLabel: string
  anchorBlockId: string | null
  anchorViewportTop: number | null
}

interface PendingHeadingReset {
  textarea: HTMLTextAreaElement
  visual: PendingVisualState
  latestText: string
  running: boolean
}

interface PendingHeadingFocus {
  format: 'h2' | 'h3'
  sourceBlockId: string | null
}

function findEditor(noteId: string) {
  return document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(noteId)}"]`)
}

function captureVisualState(editor: HTMLElement): PendingVisualState {
  const scroller = editor.querySelector<HTMLElement>('.oanix-notes__editor-container')
  const activeMode = editor.querySelector<HTMLButtonElement>('.oanix-notes__mode-row button.is-active')
  const active = document.activeElement
  const activeText = active instanceof HTMLTextAreaElement && editor.contains(active)
    && active.classList.contains('oanix-mixed-document__text')
    ? active
    : null
  const anchorBlockId = activeText?.dataset.oanixMixedTextId ?? null

  return {
    scrollTop: scroller?.scrollTop ?? 0,
    pageScrollX: window.scrollX,
    pageScrollY: window.scrollY,
    theme: editor.dataset.theme || 'default',
    modeLabel: activeMode?.textContent?.trim() ?? '',
    anchorBlockId,
    anchorViewportTop: activeText?.getBoundingClientRect().top ?? null,
  }
}

function normalizeRuledHeight(textarea: HTMLTextAreaElement) {
  const format = textarea.dataset.oanixTextFormat
  const minimum = format === 'h2' ? 42 : format === 'h3' ? 36 : format === 'paragraph' ? 30 : null
  if (minimum === null) return
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.max(minimum, textarea.scrollHeight)}px`
}

function focusInsertedHeading(noteId: string, pending: PendingHeadingFocus | null) {
  if (!pending) return
  const editor = findEditor(noteId)
  if (!editor) return
  const textareas = Array.from(editor.querySelectorAll<HTMLTextAreaElement>('.oanix-mixed-document__text'))
  const sourceIndex = pending.sourceBlockId
    ? textareas.findIndex((textarea) => textarea.dataset.oanixMixedTextId === pending.sourceBlockId)
    : -1
  const candidates = sourceIndex >= 0 ? textareas.slice(sourceIndex + 1) : textareas
  const target = candidates.find((textarea) =>
    textarea.dataset.oanixTextFormat === pending.format && textarea.value.length === 0,
  )
  if (!target) return
  target.focus({ preventScroll: true })
  target.setSelectionRange(0, 0)
  normalizeRuledHeight(target)
}

function restoreVisualState(noteId: string, state: PendingVisualState, focusBlockId?: string) {
  let focusApplied = false

  const settle = () => {
    const editor = findEditor(noteId)
    if (!editor) return

    const currentMode = editor.querySelector<HTMLButtonElement>('.oanix-notes__mode-row button.is-active')?.textContent?.trim() ?? ''
    if (state.modeLabel && currentMode !== state.modeLabel) {
      const modeButton = Array.from(editor.querySelectorAll<HTMLButtonElement>('.oanix-notes__mode-row button'))
        .find((button) => button.textContent?.trim() === state.modeLabel)
      modeButton?.click()
    }
    if (editor.dataset.theme !== state.theme) {
      const themePreview = editor.querySelector<HTMLElement>(`.oanix-notes__theme-preview.theme-${CSS.escape(state.theme)}`)
      themePreview?.closest<HTMLButtonElement>('button')?.click()
    }

    const scroller = editor.querySelector<HTMLElement>('.oanix-notes__editor-container')
    if (scroller) {
      scroller.scrollTop = state.scrollTop
      if (state.anchorBlockId && state.anchorViewportTop !== null) {
        const anchor = editor.querySelector<HTMLTextAreaElement>(`.oanix-mixed-document__text[data-oanix-mixed-text-id="${CSS.escape(state.anchorBlockId)}"]`)
        if (anchor) {
          scroller.scrollTop += anchor.getBoundingClientRect().top - state.anchorViewportTop
        }
      }
    }

    if (focusBlockId && !focusApplied) {
      const target = editor.querySelector<HTMLTextAreaElement>(`.oanix-mixed-document__text[data-oanix-mixed-text-id="${CSS.escape(focusBlockId)}"]`)
      if (target) {
        target.focus({ preventScroll: true })
        target.setSelectionRange(0, 0)
        normalizeRuledHeight(target)
        focusApplied = true
      }
    }

    if (scroller) {
      scroller.scrollTop = state.scrollTop
      if (state.anchorBlockId && state.anchorViewportTop !== null) {
        const anchor = editor.querySelector<HTMLTextAreaElement>(`.oanix-mixed-document__text[data-oanix-mixed-text-id="${CSS.escape(state.anchorBlockId)}"]`)
        if (anchor) {
          scroller.scrollTop += anchor.getBoundingClientRect().top - state.anchorViewportTop
        }
      }
    }
    window.scrollTo(state.pageScrollX, state.pageScrollY)
  }

  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    settle()
    window.requestAnimationFrame(() => {
      settle()
      window.requestAnimationFrame(settle)
    })
    window.setTimeout(settle, 80)
    window.setTimeout(settle, 220)
  }))
}

export function installOanixTextBehaviorBridge(options: InstallOptions) {
  let pendingFormatVisual: PendingVisualState | null = null
  let pendingHeadingFocus: PendingHeadingFocus | null = null
  let restoreScheduled = false
  const pendingHeadingResets = new Map<string, PendingHeadingReset>()

  const scheduleFormatRestore = () => {
    if (!pendingFormatVisual || restoreScheduled) return
    restoreScheduled = true
    const state = pendingFormatVisual
    const headingFocus = pendingHeadingFocus
    pendingFormatVisual = null
    pendingHeadingFocus = null
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      restoreScheduled = false
      restoreVisualState(options.noteId, state)
      window.requestAnimationFrame(() => focusInsertedHeading(options.noteId, headingFocus))
      window.setTimeout(() => focusInsertedHeading(options.noteId, headingFocus), 80)
      window.setTimeout(() => focusInsertedHeading(options.noteId, headingFocus), 220)
    }))
  }

  const onPointerDownCapture = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('button[data-tool]')
    const tool = button?.dataset.tool ?? ''
    if (!['paragraph', 'h2', 'h3', 'quote', 'list', 'numbered-list'].includes(tool)) return
    const editor = findEditor(options.noteId)
    if (!editor || !button || !editor.contains(button)) return
    pendingFormatVisual = captureVisualState(editor)

    const active = document.activeElement
    if ((tool === 'h2' || tool === 'h3') && active instanceof HTMLTextAreaElement && editor.contains(active)) {
      const selectionStart = active.selectionStart ?? 0
      const selectionEnd = active.selectionEnd ?? selectionStart
      if (selectionStart === selectionEnd) {
        pendingHeadingFocus = {
          format: tool,
          sourceBlockId: active.dataset.oanixMixedTextId ?? null,
        }
        event.preventDefault()
      }
    }
  }

  const persistParagraphPriority = async (blockId: string, reset: PendingHeadingReset) => {
    const loadBlocks = options.loadBlocks
    const saveBlocks = options.onRequestBlockSave
    if (!loadBlocks || !saveBlocks || reset.running) return
    reset.running = true

    try {
      let lastSavedText: string | null = null
      while (lastSavedText !== reset.latestText) {
        const blocks = await loadBlocks()
        const nextText: string = reset.latestText
        const paragraph = buildHeadingParagraphReset(blocks, blockId, nextText)
        if (!paragraph) {
          options.onRefresh()
          restoreVisualState(options.noteId, reset.visual, blockId)
          return
        }
        const saved = await saveBlocks({ upserts: [paragraph] })
        if (!saved) {
          options.onRefresh()
          restoreVisualState(options.noteId, reset.visual, blockId)
          return
        }
        lastSavedText = nextText
      }

      options.onRefresh()
      restoreVisualState(options.noteId, reset.visual, blockId)
    } catch {
      options.onRefresh()
      restoreVisualState(options.noteId, reset.visual, blockId)
    } finally {
      pendingHeadingResets.delete(blockId)
    }
  }

  const onInputCapture = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLTextAreaElement) || !target.classList.contains('oanix-mixed-document__text')) return
    const editor = findEditor(options.noteId)
    if (!editor || !editor.contains(target)) return
    const blockId = target.dataset.oanixMixedTextId
    if (!blockId) return

    const existingReset = pendingHeadingResets.get(blockId)
    if (existingReset) {
      event.stopImmediatePropagation()
      existingReset.latestText = target.value
      target.dataset.oanixTextFormat = 'paragraph'
      normalizeRuledHeight(target)
      return
    }

    const format = target.dataset.oanixTextFormat
    if ((format !== 'h2' && format !== 'h3') || target.value.length !== 0) return

    event.stopImmediatePropagation()
    target.dataset.oanixTextFormat = 'paragraph'
    normalizeRuledHeight(target)
    const reset: PendingHeadingReset = {
      textarea: target,
      visual: captureVisualState(editor),
      latestText: '',
      running: false,
    }
    pendingHeadingResets.set(blockId, reset)
    void persistParagraphPriority(blockId, reset)
  }

  const onInputBubble = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLTextAreaElement) || !target.classList.contains('oanix-mixed-document__text')) return
    const editor = findEditor(options.noteId)
    if (!editor || !editor.contains(target)) return
    normalizeRuledHeight(target)
  }

  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return
    const target = event.target
    if (!(target instanceof HTMLTextAreaElement) || !target.classList.contains('oanix-mixed-document__text')) return
    const editor = findEditor(options.noteId)
    if (!editor || !editor.contains(target)) return

    if (event.key === 'Backspace' && !event.shiftKey) {
      const selectionStart = target.selectionStart ?? 0
      const selectionEnd = target.selectionEnd ?? selectionStart
      if (selectionStart !== 0 || selectionEnd !== 0) return

      const textareas = Array.from(editor.querySelectorAll<HTMLTextAreaElement>('.oanix-mixed-document__text'))
      const index = textareas.indexOf(target)
      const previous = index > 0 ? textareas[index - 1] : null
      if (!previous) return

      event.preventDefault()
      event.stopPropagation()
      previous.focus({ preventScroll: true })
      const end = previous.value.length
      previous.setSelectionRange(end, end)
      normalizeRuledHeight(previous)
      return
    }

    if (event.key !== 'Enter' || event.shiftKey) return
    const loadBlocks = options.loadBlocks
    const saveBlocks = options.onRequestBlockSave
    if (!loadBlocks || !saveBlocks) return
    const format = target.dataset.oanixTextFormat
    if (format !== 'h2' && format !== 'h3') return
    const blockId = target.dataset.oanixMixedTextId
    if (!blockId) return

    event.preventDefault()
    event.stopPropagation()
    const visual = captureVisualState(editor)
    const selectionStart = target.selectionStart ?? target.value.length
    const selectionEnd = target.selectionEnd ?? selectionStart
    const liveText = target.value

    void loadBlocks().then(async (blocks) => {
      const plan = buildHeadingEnterPlan(blocks, blockId, selectionStart, selectionEnd, undefined, liveText, format)
      if (!plan) return
      const saved = await saveBlocks({
        upserts: [plan.heading, plan.paragraph],
        order: plan.order,
      })
      if (!saved) return
      options.onRefresh()
      restoreVisualState(options.noteId, visual, plan.paragraphId)
    }).catch(() => undefined)
  }

  const observer = new MutationObserver((records) => {
    if (!pendingFormatVisual) return
    if (records.some((record) => record.type === 'childList')) scheduleFormatRestore()
  })

  document.addEventListener('pointerdown', onPointerDownCapture, true)
  document.addEventListener('input', onInputCapture, true)
  document.addEventListener('input', onInputBubble)
  document.addEventListener('keydown', onKeyDownCapture, true)
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    document.removeEventListener('pointerdown', onPointerDownCapture, true)
    document.removeEventListener('input', onInputCapture, true)
    document.removeEventListener('input', onInputBubble)
    document.removeEventListener('keydown', onKeyDownCapture, true)
    observer.disconnect()
    pendingHeadingResets.clear()
  }
}
