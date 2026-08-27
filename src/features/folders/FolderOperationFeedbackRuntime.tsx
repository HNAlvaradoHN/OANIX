import { useEffect } from 'react'
import './folderOperationFeedback.css'

type OperationState = 'busy' | 'success' | 'error' | 'hint'

const FOLDER_CUSTOMIZER_SELECTOR = '.oanix-folder-customizer'

function mutationTouchesFolderCustomizer(record: MutationRecord): boolean {
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
  return nodes.some((node) => {
    if (!(node instanceof Element)) return false
    return node.matches(FOLDER_CUSTOMIZER_SELECTOR) || node.querySelector(FOLDER_CUSTOMIZER_SELECTOR) !== null
  })
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

export function FolderOperationFeedbackRuntime() {
  useEffect(() => {
    let clearTimer: number | null = null
    let hintTimer: number | null = null

    const clearLater = (modal: HTMLElement, delay = 900) => {
      if (clearTimer !== null) window.clearTimeout(clearTimer)
      clearTimer = window.setTimeout(() => {
        clearTimer = null
        if (modal.isConnected && modal.dataset.oanixOperationState !== 'busy') clearStatus(modal)
      }, delay)
    }

    const syncReactBusyState = () => {
      const modal = document.querySelector<HTMLElement>(FOLDER_CUSTOMIZER_SELECTOR)
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

    let modalObserver: MutationObserver | null = null
    let observedModal: HTMLElement | null = null

    const bindModalObserver = () => {
      const nextModal = document.querySelector<HTMLElement>(FOLDER_CUSTOMIZER_SELECTOR)
      if (nextModal === observedModal) return

      modalObserver?.disconnect()
      observedModal = nextModal
      if (!observedModal) {
        modalObserver = null
        return
      }

      modalObserver = new MutationObserver(syncReactBusyState)
      modalObserver.observe(observedModal, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled'],
      })
      syncReactBusyState()
    }

    const portalObserver = new MutationObserver((records) => {
      if (records.some(mutationTouchesFolderCustomizer)) bindModalObserver()
    })

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const modal = target.closest<HTMLElement>(FOLDER_CUSTOMIZER_SELECTOR)
      if (!modal) return

      const selectionButton = target.closest<HTMLButtonElement>(
        '.oanix-folder-appearance-picker__icon, .oanix-folder-appearance-picker__swatch',
      )
      if (selectionButton) return

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
      const modal = target.closest<HTMLElement>(FOLDER_CUSTOMIZER_SELECTOR)
      if (!modal || !target.files?.length) return
      if (hintTimer !== null) {
        window.clearTimeout(hintTimer)
        hintTimer = null
      }
      setStatus(modal, '⏳ Procesando y cifrando imagen…', 'busy', 'react')
    }

    const handleAppearanceSaved = () => {
      const modal = document.querySelector<HTMLElement>(FOLDER_CUSTOMIZER_SELECTOR)
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
      if (clearTimer !== null) window.clearTimeout(clearTimer)
      if (hintTimer !== null) window.clearTimeout(hintTimer)
    }
  }, [])

  return null
}
