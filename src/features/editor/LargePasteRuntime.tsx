import { useEffect } from 'react'
import { shouldEncapsulateClipboardPaste } from './largePastePolicy'
import './mobileEditorStability.css'

function selectionInsideEditor(editor: HTMLElement): boolean {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return false
  return editor.contains(selection.getRangeAt(0).commonAncestorContainer)
}

function ensureEditorSelection(editor: HTMLElement, target: Element): boolean {
  if (selectionInsideEditor(editor)) return true

  const targetBlock = target.closest<HTMLElement>('[data-block-id]')
  const anchor = targetBlock && editor.contains(targetBlock)
    ? targetBlock
    : editor.lastElementChild instanceof HTMLElement
      ? editor.lastElementChild
      : editor

  const selection = document.getSelection()
  if (!selection) return false

  editor.focus({ preventScroll: true })
  const range = document.createRange()
  range.selectNodeContents(anchor)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  return selectionInsideEditor(editor)
}

function codeContentFromBlock(block: HTMLElement | null): HTMLElement | null {
  return block?.querySelector<HTMLElement>('[data-code-content="true"]') ?? null
}

function directEditorBlock(editor: HTMLElement, element: Element | null): HTMLElement | null {
  const block = element?.closest<HTMLElement>('[data-block-id]') ?? null
  return block?.parentElement === editor ? block : null
}

function dailyPageBounds(
  editor: HTMLElement,
  referenceBlock: HTMLElement | null,
): { first: HTMLElement; last: HTMLElement } | null {
  if (!referenceBlock || referenceBlock.parentElement !== editor) return null

  const blocks = Array.from(editor.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  )
  const referenceIndex = blocks.indexOf(referenceBlock)
  if (referenceIndex < 0) return null

  let dailyIndex = -1
  for (let index = referenceIndex; index >= 0; index -= 1) {
    if (blocks[index]?.dataset.dailyEntryBlock === 'true') {
      dailyIndex = index
      break
    }
  }
  if (dailyIndex < 0) return null

  let nextDailyIndex = blocks.length
  for (let index = dailyIndex + 1; index < blocks.length; index += 1) {
    if (blocks[index]?.dataset.dailyEntryBlock === 'true') {
      nextDailyIndex = index
      break
    }
  }

  const editable = blocks.slice(dailyIndex + 1, nextDailyIndex)
  const first = editable[0]
  const last = editable.at(-1)
  return first && last ? { first, last } : null
}

function selectionTouchesDailyChrome(editor: HTMLElement, selection: Selection): boolean {
  if (selection.isCollapsed || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  return Array.from(editor.querySelectorAll<HTMLElement>('[data-daily-entry-block="true"]'))
    .some((entry) => {
      try {
        return range.intersectsNode(entry)
      } catch {
        return false
      }
    })
}

function selectionSpansMultipleDailyPages(editor: HTMLElement, selection: Selection): boolean {
  if (selection.isCollapsed || selection.rangeCount === 0) return false
  const range = selection.getRangeAt(0)
  let touchedPages = 0

  for (const entry of editor.querySelectorAll<HTMLElement>('[data-daily-entry-block="true"]')) {
    try {
      if (range.intersectsNode(entry)) touchedPages += 1
    } catch {
      // Ignore nodes detached during an editor mutation.
    }
    if (touchedPages > 1) return true
  }

  return false
}

function referenceBlockFromActiveElement(editor: HTMLElement): HTMLElement | null {
  const active = document.activeElement
  if (!(active instanceof Element) || !editor.contains(active)) return null
  return directEditorBlock(editor, active)
}

function protectDailyPageSelection(
  editor: HTMLElement,
  lastInteractionBlock: HTMLElement | null,
): HTMLElement | null {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return lastInteractionBlock

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return lastInteractionBlock
  if (!selectionTouchesDailyChrome(editor, selection) && !selectionSpansMultipleDailyPages(editor, selection)) {
    return lastInteractionBlock
  }

  const anchorElement = selection.anchorNode instanceof Element
    ? selection.anchorNode
    : selection.anchorNode?.parentElement ?? null
  const reference = lastInteractionBlock?.isConnected
    ? lastInteractionBlock
    : referenceBlockFromActiveElement(editor) ?? directEditorBlock(editor, anchorElement)
  const bounds = dailyPageBounds(editor, reference)
  if (!bounds) return lastInteractionBlock

  const protectedRange = document.createRange()
  protectedRange.setStartBefore(bounds.first)
  protectedRange.setEndAfter(bounds.last)
  selection.removeAllRanges()
  selection.addRange(protectedRange)
  return reference
}

function clipboardTextFromBeforeInput(event: InputEvent): string {
  return event.dataTransfer?.getData('text/plain') ?? event.data ?? ''
}

export function LargePasteRuntime() {
  useEffect(() => {
    let lastInteractionBlock: HTMLElement | null = null
    let adjustingSelection = false
    let handledText = ''
    let handledAt = 0
    const duplicateWindowMs = 3_000

    function rememberInteractionTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) return
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return

      const block = directEditorBlock(editor, target)
      if (block) lastInteractionBlock = block
    }

    function rememberPointerInteraction(event: PointerEvent) {
      rememberInteractionTarget(event.target)
    }

    function rememberFocusInteraction(event: FocusEvent) {
      rememberInteractionTarget(event.target)
    }

    function guardDailySelection() {
      if (adjustingSelection) return

      let block = lastInteractionBlock
      let editor = block?.parentElement
      if (!(editor instanceof HTMLElement) || !editor.classList.contains('editor-surface')) {
        const active = document.activeElement
        const activeEditor = active instanceof Element
          ? active.closest<HTMLElement>('.editor-surface')
          : null
        if (!activeEditor) return
        editor = activeEditor
        block = referenceBlockFromActiveElement(activeEditor)
        if (block) lastInteractionBlock = block
      }

      adjustingSelection = true
      try {
        lastInteractionBlock = protectDailyPageSelection(editor, block)
      } finally {
        queueMicrotask(() => {
          adjustingSelection = false
        })
      }
    }

    function isDuplicateLargePaste(plainText: string): boolean {
      return plainText === handledText && performance.now() - handledAt < duplicateWindowMs
    }

    function consumeDuplicate(event: ClipboardEvent | InputEvent, plainText: string): boolean {
      if (!plainText || !shouldEncapsulateClipboardPaste(plainText) || !isDuplicateLargePaste(plainText)) {
        return false
      }

      event.preventDefault()
      event.stopPropagation()
      return true
    }

    function encapsulateLargePaste(
      event: ClipboardEvent | InputEvent,
      target: Element,
      plainText: string,
    ) {
      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return
      if (!plainText || !shouldEncapsulateClipboardPaste(plainText)) return

      // Android WebView can emit the same paste through ClipboardEvent and then
      // InputEvent after focus has already moved into the freshly-created code
      // block. Consume that second delivery before inspecting its new target,
      // otherwise the same text is inserted again outside/inside the console.
      if (consumeDuplicate(event, plainText)) return

      if (target.closest('[data-contact-field], [data-daily-entry-title="true"]')) return
      if (target.closest('[data-code-content="true"]')) return

      if (!ensureEditorSelection(editor, target)) {
        event.preventDefault()
        event.stopPropagation()
        window.alert('OANIX no pudo ubicar el pegado grande dentro de la nota. El contenido sigue disponible en tu portapapeles.')
        return
      }

      const frame = editor.closest<HTMLElement>('.editor-frame')
      const codeTool = frame?.querySelector<HTMLButtonElement>('[data-format="code"]')
      if (!codeTool) return

      const existingBlocks = new Set(
        Array.from(editor.querySelectorAll<HTMLElement>('[data-code-block="true"]')),
      )

      event.preventDefault()
      event.stopPropagation()
      handledText = plainText
      handledAt = performance.now()
      codeTool.click()

      const insertedBlock = Array.from(
        editor.querySelectorAll<HTMLElement>('[data-code-block="true"]'),
      ).find((block) => !existingBlocks.has(block)) ?? null
      const activeContent = document.activeElement instanceof Element
        ? document.activeElement.closest<HTMLElement>('[data-code-content="true"]')
        : null
      const content = activeContent && editor.contains(activeContent)
        ? activeContent
        : codeContentFromBlock(insertedBlock)

      if (!content) {
        window.alert('OANIX no pudo preparar el bloque para este pegado grande. El contenido sigue disponible en tu portapapeles.')
        return
      }

      content.textContent = plainText
      content.focus({ preventScroll: true })
      content.dispatchEvent(new Event('input', { bubbles: true }))
      if (insertedBlock) lastInteractionBlock = insertedBlock
    }

    function handlePaste(event: ClipboardEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      encapsulateLargePaste(event, target, event.clipboardData?.getData('text/plain') ?? '')
    }

    function handleBeforeInput(event: InputEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const editor = target.closest<HTMLElement>('.editor-surface')
      if (!editor) return

      if (event.inputType.startsWith('delete')) {
        if (!target.closest('[data-daily-entry-title="true"]')) guardDailySelection()
        return
      }

      if (event.inputType !== 'insertFromPaste') return
      encapsulateLargePaste(event, target, clipboardTextFromBeforeInput(event))
    }

    function handleDeleteKey(event: KeyboardEvent) {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      const target = event.target
      if (target instanceof Element && target.closest('[data-daily-entry-title="true"]')) return
      guardDailySelection()
    }

    document.addEventListener('pointerdown', rememberPointerInteraction, true)
    document.addEventListener('focusin', rememberFocusInteraction, true)
    document.addEventListener('selectionchange', guardDailySelection)
    document.addEventListener('keydown', handleDeleteKey, true)
    document.addEventListener('paste', handlePaste, true)
    document.addEventListener('beforeinput', handleBeforeInput, true)
    return () => {
      document.removeEventListener('pointerdown', rememberPointerInteraction, true)
      document.removeEventListener('focusin', rememberFocusInteraction, true)
      document.removeEventListener('selectionchange', guardDailySelection)
      document.removeEventListener('keydown', handleDeleteKey, true)
      document.removeEventListener('paste', handlePaste, true)
      document.removeEventListener('beforeinput', handleBeforeInput, true)
    }
  }, [])

  return null
}
