import { useEffect } from 'react'
import { loadFolderColors, removeFolderColor, saveFolderColor } from './folderAppearanceService'

const DEFAULT_FOLDER_COLOR = '#111b31'
const PRESET_COLORS = ['#111b31', '#172554', '#241a3b', '#17342f', '#3a281d', '#252a37']

function applyColor(folderId: string, color: string) {
  document.querySelectorAll<HTMLElement>(`[data-oanix-folder-id="${CSS.escape(folderId)}"]`).forEach((card) => {
    card.style.setProperty('--oanix-folder-color', color)
  })
}

function makeColorButton(folderId: string, color: string) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'oanix-folder-appearance-picker__swatch'
  button.style.setProperty('--oanix-folder-swatch', color)
  button.setAttribute('aria-label', `Usar color ${color}`)
  button.title = color
  button.addEventListener('click', () => {
    void saveFolderColor(folderId, color).then(() => applyColor(folderId, color))
  })
  return button
}

export function FolderAppearanceRuntime() {
  useEffect(() => {
    let disposed = false
    let lastFolderId = ''
    let colors = new Map<string, string>()

    const paintCards = () => {
      document.querySelectorAll<HTMLElement>('[data-oanix-folder-id]').forEach((card) => {
        const folderId = card.dataset.oanixFolderId
        if (!folderId) return
        card.style.setProperty('--oanix-folder-color', colors.get(folderId) ?? DEFAULT_FOLDER_COLOR)
      })
    }

    const decorateCustomizer = () => {
      const modal = document.querySelector<HTMLElement>('.oanix-folder-customizer')
      if (!modal || modal.querySelector('.oanix-folder-appearance-picker') || !lastFolderId) return

      const actions = modal.querySelector<HTMLElement>('.oanix-folder-customizer__actions')
      if (!actions) return

      const section = document.createElement('div')
      section.className = 'oanix-folder-appearance-picker'

      const heading = document.createElement('div')
      heading.className = 'oanix-folder-appearance-picker__heading'
      heading.innerHTML = '<strong>Color de carpeta</strong><small>Elige un tono o personalízalo.</small>'

      const row = document.createElement('div')
      row.className = 'oanix-folder-appearance-picker__row'
      PRESET_COLORS.forEach((color) => row.appendChild(makeColorButton(lastFolderId, color)))

      const input = document.createElement('input')
      input.type = 'color'
      input.className = 'oanix-folder-appearance-picker__custom'
      input.value = colors.get(lastFolderId) ?? DEFAULT_FOLDER_COLOR
      input.setAttribute('aria-label', 'Elegir color personalizado')
      input.addEventListener('input', () => applyColor(lastFolderId, input.value))
      input.addEventListener('change', () => {
        const value = input.value
        void saveFolderColor(lastFolderId, value).then(() => {
          colors.set(lastFolderId, value)
          applyColor(lastFolderId, value)
        })
      })
      row.appendChild(input)

      const reset = document.createElement('button')
      reset.type = 'button'
      reset.className = 'oanix-folder-appearance-picker__reset'
      reset.textContent = 'Restablecer'
      reset.addEventListener('click', () => {
        void removeFolderColor(lastFolderId).then(() => {
          colors.delete(lastFolderId)
          applyColor(lastFolderId, DEFAULT_FOLDER_COLOR)
          input.value = DEFAULT_FOLDER_COLOR
        })
      })

      section.append(heading, row, reset)
      actions.before(section)
    }

    const captureMenuTarget = (event: Event) => {
      const target = event.target as Element | null
      const card = target?.closest<HTMLElement>('[data-oanix-folder-id]')
      const customizeTrigger = target?.closest(
        '.oanix-folder-card__menu, .oanix-folder-focus__menu, [data-oanix-folder-customize]',
      )
      if (card && customizeTrigger) lastFolderId = card.dataset.oanixFolderId ?? ''
    }

    const observer = new MutationObserver(() => {
      paintCards()
      decorateCustomizer()
    })

    document.addEventListener('pointerdown', captureMenuTarget, true)
    observer.observe(document.body, { childList: true, subtree: true })

    void loadFolderColors().then((loaded) => {
      if (disposed) return
      colors = loaded
      paintCards()
    })

    return () => {
      disposed = true
      document.removeEventListener('pointerdown', captureMenuTarget, true)
      observer.disconnect()
    }
  }, [])

  return null
}
