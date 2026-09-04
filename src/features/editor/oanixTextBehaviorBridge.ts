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
  theme: string
  modeLabel: string
}

interface PendingHeadingReset {
  textarea: HTMLTextAreaElement
  visual: PendingVisualState
  latestText: string
  running: boolean
}

function findEditor(noteId: string) {
  return document.querySelector<HTMLElement>(`.oanix-notes[data-note-id="${CSS.escape(noteId)}"]`)
}

function captureVisualState(editor: HTMLElement): PendingVisualState {
  const scroller = editor.querySelector<HTMLElement>('.oanix-notes__editor-container')
  const activeMode = editor.querySelector<HTMLButtonElement>('.oanix-notes__mode-row button.is-active')
  return {
    scrollTop: scroller?.scrollTop ?? 0,
    theme: editor.dataset.theme || 'default',
    modeLabel: activeMode?.textContent?.trim() ?? '',
  }
}

function restoreVisualState(noteId: string, state: PendingVisualState, focusBlockId?: string) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    const editor = findEditor(noteId)
    if (!editor) return

    if (state.modeLabel) {
      const modeButton = Array.from(editor.querySelectorAll<HTMLButtonElement>('.oanix-notes__mode-row button.is-active, .oanix-notes__mode-row button'))
        .find((button) => button.textContent?.trim() === state.modeLabel)
      modeButton?.click()
    }
    const themePreview = editor.querySelector<HTMLElement>(`.oanix-notes__theme-preview.theme-${CSS.escape(state.theme)}`)
    themePreview?.closest<HTMLButtonElement>('button')?.click()

    const scroller = editor.querySelector<HTMLElement>('.oanix-notes__editor-container')
    if (scroller) scroller.scrollTop = state.scrollTop

    if (focusBlockId) {
      const target = editor.querySelector<HTMLTextAreaElement>(`.oanix-mixed-document__text[data-oanix-mixed-text-id="${CSS.escape(focusBlockId)}"]`)
      if (target) {
        target.focus({ preventScroll: true })
        target.setSelectionRange(0, 0)
        normalizeRuledHeight(target)
      }
      if (scroller) scroller.scrollTop = state.scrollTop
    }
  }))
}

function normalizeRuledHeight(textarea: HTMLTextAreaElement) {
  const format = textarea.dataset.oanixTextFormat
  const minimum = format === 'h2' ? 42 : format === 'h3' ? 36 : format === 'paragraph' ? 30 : null
  if (minimum === null) return
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.max(minimum, textarea.scrollHeight)}px`
}

export function installOanixTextBehaviorBridge(options: InstallOptions) {
  let pendingFormatVisual: PendingVisualState | null = null
  let restoreScheduled = false
  const pendingHeadingResets = new Map<string, PendingHeadingReset>()

  const scheduleFormatRestore = () => {
    if (!pendingFormatVisual || restoreScheduled) return
    restoreScheduled = true
    const state = pendingFormatVisual
    pendingFormatVisual = null
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      restoreScheduled = false
      restoreVisualState(options.noteId, state)
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
  }

  const persistParagraphPriority = async (blockId: string, reset: PendingHeadingReset) => {
    const loadBlocks = options.loadBlocks
    const saveBlocks = options.onRequestBlockSave
    if (!loadBlocks || !saveBlocks || reset.running) return
    reset.running = true

    try {
      const blocks = await loadBlocks()
      let lastSavedText: string | null = null
      while (lastSavedText !== reset.latestText) {
        const nextText = reset.latestText
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
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return
    const target = event.target
    if (!(target instanceof HTMLTextAreaElement) || !target.classList.contains('oanix-mixed-document__text')) return
    const editor = findEditor(options.noteId)
    const loadBlocks = options.loadBlocks
    const saveBlocks = options.onRequestBlockSave
    if (!editor || !editor.contains(target) || !loadBlocks || !saveBlocks) return
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
      const plan = buildHeadingEnterPlan(blocks, blockId, selectionStart, selectionEnd, undefined, liveText)
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