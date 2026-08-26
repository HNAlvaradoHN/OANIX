import { useEffect } from 'react'
import './folderOperationFeedback.css'

type OperationState = 'busy' | 'success' | 'error' | 'hint'
type SelectionKind = 'icon' | 'color'

interface IconPreviewSnapshot {
  element: HTMLElement
  value?: string
}

interface PendingSelection {
  kind: SelectionKind
  button: HTMLButtonElement
  modal: HTMLElement
  timeoutId: number
  iconSnapshot?: IconPreviewSnapshot[]
}

function setStatus(modal: HTMLElement, message: string, state: OperationState, source: string) {
  modal.dataset.oanixOperationStatus = message
  modal.dataset.oanixOperationState = state
  modal.dataset.oanixOperationSource = source
}

function clearStatus(modal: HTMLElement) {
  delete modal.dataset.oanixOperationStatus
  delete modal.dataset.oanixOperationState
  delete modal.dataset.oanixOperationSource
}

function previewFolderIcon(folderId: string, icon: string): IconPreviewSnapshot[] {
  const snapshot: IconPreviewSnapshot[] = []
  document
    .querySelectorAll<HTMLElement>(`[data-oanix-folder-id="${CSS.escape(folderId)}"] .oanix-folder-rail__shape`)
    .forEach((element) => {
      snapshot.push({ element, value: element.dataset.oanixFolderIcon })
      element.dataset.oanixFolderIcon = icon
    })
  return snapshot
}

function restoreFolderIcon(snapshot: IconPreviewSnapshot[]) {
  snapshot.forEach(({ element, value }) => {
    if (!element.isConnected) return
    if (value) element.dataset.oanixFolderIcon = value
    else delete element.dataset.oanixFolderIcon
  })
}

export function FolderOperationFeedbackRuntime() {
  useEffect(() => {
    let pendingSelection: PendingSelection | null = null
    let clearTimer: number | null = null
    let hintTimer: number | null = null

    const clearLater = (modal: HTMLElement, delay = 900) => {
      if (clearTimer !== null) window.clearTimeout(clearTimer)
      clearTimer = window.setTimeout(() => {
        clearTimer = null
        if (modal.isConnected && modal.dataset.oanixOperationState !== 'busy') clearStatus(modal)
      }, delay)
    }

    const finishSelection = () => {
      const pending = pendingSelection
      if (!pending) return
      window.clearTimeout(pending.timeoutId)
      pending.button.removeAttribute('aria-busy')
      setStatus(pending.modal, 'Vista previa aplicada', 'success', 'appearance')
      clearLater(pending.modal)
      pendingSelection = null
    }

    const syncReactBusyState = () => {
      const modal = document.querySelector<HTMLElement>('.oanix-folder-customizer')
      if (!modal) return
      const actionButtons = Array.from(
        modal.querySelectorAll<HTMLButtonElement>('.oanix-folder-customizer__actions > button'),
      )
      const reactBusy = actionButtons.some((button) => button.disabled)

      if (reactBusy) {
        if (modal.dataset.oanixOperationSource !== 'appearance') {
          const current = modal.dataset.oanixOperationStatus
          setStatus(modal, current || '⏳ Procesando cambio cifrado…', 'busy', 'react')
        }
        return
      }

      if (modal.dataset.oanixOperationSource === 'react') {
        const error = modal.querySelector<HTMLElement>('.oanix-folder-customizer__error')?.textContent?.trim()
        if (error) {
          setStatus(modal, error, 'error', 'react')
          clearLater(modal, 1800)
        } else if (modal.dataset.oanixOperationState === 'busy') {
          clearStatus(modal)
        }
      }
    }

    const handleModalMutation = () => {
      if (pendingSelection?.button.dataset.selected === 'true') finishSelection()
      syncReactBusyState()
    }

    let modalObserver: MutationObserver | null = null
    let observedModal: HTMLElement | null = null

    const bindModalObserver = () => {
      const nextModal = document.querySelector<HTMLElement>('.oanix-folder-customizer')
      if (nextModal === observedModal) return

      modalObserver?.disconnect()
      observedModal = nextModal
      if (!observedModal) {
        modalObserver = null
        return
      }

      modalObserver = new MutationObserver(handleModalMutation)
      modalObserver.observe(observedModal, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-selected', 'disabled'],
      })
      syncReactBusyState()
    }

    const portalObserver = new MutationObserver(bindModalObserver)

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const modal = target.closest<HTMLElement>('.oanix-folder-customizer')
      if (!modal) return

      const iconButton = target.closest<HTMLButtonElement>('.oanix-folder-appearance-picker__icon')
      const colorButton = target.closest<HTMLButtonElement>('.oanix-folder-appearance-picker__swatch')
      const selectionButton = iconButton ?? colorButton
      if (selectionButton) {
        if (pendingSelection) {
          event.preventDefault()
          event.stopPropagation()
          return
        }

        if (selectionButton.dataset.selected === 'true') {
          event.preventDefault()
          event.stopPropagation()
          setStatus(modal, 'Vista previa aplicada', 'success', 'appearance')
          clearLater(modal, 700)
          return
        }

        const kind: SelectionKind = iconButton ? 'icon' : 'color'
        let iconSnapshot: IconPreviewSnapshot[] | undefined
        if (iconButton) {
          const folderId = modal.dataset.oanixFolderId
          const icon = iconButton.textContent?.trim()
          if (folderId && icon) iconSnapshot = previewFolderIcon(folderId, icon)
        }

        setStatus(modal, 'Vista previa aplicada', 'success', 'appearance')
        selectionButton.setAttribute('aria-busy', 'true')

        const timeoutId = window.setTimeout(() => {
          const pending = pendingSelection
          if (!pending || pending.button !== selectionButton) return
          pending.button.removeAttribute('aria-busy')
          if (pending.iconSnapshot) restoreFolderIcon(pending.iconSnapshot)
          setStatus(pending.modal, 'El cambio está tardando más de lo esperado.', 'error', 'appearance')
          clearLater(pending.modal, 2200)
          pendingSelection = null
        }, 10000)

        pendingSelection = { kind, button: selectionButton, modal, timeoutId, iconSnapshot }
        return
      }

      const imageButton = target.closest<HTMLButtonElement>('.oanix-folder-customizer__image-action')
      if (imageButton) {
        setStatus(modal, 'Selecciona una imagen de tu dispositivo.', 'hint', 'picker')
        if (hintTimer !== null) window.clearTimeout(hintTimer)
        hintTimer = window.setTimeout(() => {
          hintTimer = null
          if (modal.isConnected && modal.dataset.oanixOperationSource === 'picker') clearStatus(modal)
        }, 2400)
        return
      }

      const removeButton = target.closest<HTMLButtonElement>('.oanix-folder-customizer__remove')
      if (removeButton) {
        setStatus(modal, '⏳ Quitando imagen…', 'busy', 'react')
      }
    }

    const handleChangeCapture = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.type !== 'file') return
      const modal = target.closest<HTMLElement>('.oanix-folder-customizer')
      if (!modal || !target.files?.length) return
      if (hintTimer !== null) {
        window.clearTimeout(hintTimer)
        hintTimer = null
      }
      setStatus(modal, '⏳ Procesando y cifrando imagen…', 'busy', 'react')
    }

    const handleAppearanceSaved = () => {
      const modal = document.querySelector<HTMLElement>('.oanix-folder-customizer')
      if (!modal) return
      setStatus(modal, '✓ Guardado', 'success', 'appearance')
      clearLater(modal, 700)
    }

    document.addEventListener('click', handleClickCapture, true)
    document.addEventListener('change', handleChangeCapture, true)
    window.addEventListener('oanix:folder-appearance-saved', handleAppearanceSaved)
    bindModalObserver()
    portalObserver.observe(document.body, { childList: true })
    syncReactBusyState()

    return () => {
      document.removeEventListener('click', handleClickCapture, true)
      document.removeEventListener('change', handleChangeCapture, true)
      window.removeEventListener('oanix:folder-appearance-saved', handleAppearanceSaved)
      portalObserver.disconnect()
      modalObserver?.disconnect()
      if (pendingSelection) window.clearTimeout(pendingSelection.timeoutId)
      if (clearTimer !== null) window.clearTimeout(clearTimer)
      if (hintTimer !== null) window.clearTimeout(hintTimer)
    }
  }, [])

  return null
}
