import type { EditorSurfaceBlock, EditorSurfaceProps } from './editorSurfaceContract.ts'
import { decodeTextBlock, encodeTextBlock, TEXT_BLOCK_KIND } from './textBlockCodec.ts'

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
      }
      if (scroller) scroller.scrollTop = state.scrollTop
    }
  }))
}

export function buildHeadingEnterPlan(
  blocks: readonly EditorSurfaceBlock[],
  targetId: string,
  selectionStart: number,
  selectionEnd: number,
  createId: () => string = () => `oanix-text-${crypto.randomUUID()}`,
) {
  const index = blocks.findIndex((block) => block.id === targetId)
  if (index < 0) return null
  const target = decodeTextBlock(blocks[index])
  if (!target || (target.format !== 'h2' && target.format !== 'h3')) return null

  const start = Math.max(0, Math.min(selectionStart, selectionEnd, target.text.length))
  const end = Math.max(start, Math.min(Math.max(selectionStart, selectionEnd), target.text.length))
  const paragraphId = createId()
  const heading = encodeTextBlock({
    id: target.id,
    kind: TEXT_BLOCK_KIND,
    text: target.text.slice(0, start),
    format: target.format,
  })
  const paragraph = encodeTextBlock({
    id: paragraphId,
    kind: TEXT_BLOCK_KIND,
    text: target.text.slice(end),
    format: 'paragraph',
  })
  const nextBlocks = [
    ...blocks.slice(0, index),
    heading,
    paragraph,
    ...blocks.slice(index + 1),
  ]
  return { heading, paragraph, paragraphId, order: nextBlocks.map((block) => block.id) }
}

export function installOanixTextBehaviorBridge(options: InstallOptions) {
  let pendingFormatVisual: PendingVisualState | null = null
  let restoreScheduled = false

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

  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return
    const target = event.target
    if (!(target instanceof HTMLTextAreaElement) || !target.classList.contains('oanix-mixed-document__text')) return
    const editor = findEditor(options.noteId)
    if (!editor || !editor.contains(target) || !options.loadBlocks || !options.onRequestBlockSave) return
    const format = target.dataset.oanixTextFormat
    if (format !== 'h2' && format !== 'h3') return
    const blockId = target.dataset.oanixMixedTextId
    if (!blockId) return

    event.preventDefault()
    event.stopPropagation()
    const visual = captureVisualState(editor)
    const selectionStart = target.selectionStart ?? target.value.length
    const selectionEnd = target.selectionEnd ?? selectionStart

    void options.loadBlocks().then(async (blocks) => {
      const plan = buildHeadingEnterPlan(blocks, blockId, selectionStart, selectionEnd)
      if (!plan) return
      const saved = await options.onRequestBlockSave!({
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
  document.addEventListener('keydown', onKeyDownCapture, true)
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    document.removeEventListener('pointerdown', onPointerDownCapture, true)
    document.removeEventListener('keydown', onKeyDownCapture, true)
    observer.disconnect()
  }
}
