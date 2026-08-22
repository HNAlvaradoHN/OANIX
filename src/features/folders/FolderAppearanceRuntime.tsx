import { useEffect } from 'react'
import {
  DEFAULT_FOLDER_COLOR,
  DEFAULT_FOLDER_ICON,
  FOLDER_COLOR_PRESETS,
  FOLDER_DEFAULT_ICONS,
  FOLDER_ICON_OPTIONS,
  type FolderIcon,
} from './folderAppearanceCatalog'
import {
  loadFolderColors,
  loadFolderIcons,
  removeFolderColor,
  removeFolderIcon,
  saveFolderColor,
  saveFolderIcon,
} from './folderAppearanceService'
import './folderReferencePolish.css'

function folderElements(folderId: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(
    `[data-oanix-folder-id="${CSS.escape(folderId)}"]`,
  ))
}

function applyColor(folderId: string, color: string) {
  folderElements(folderId).forEach((element) => {
    element.style.setProperty('--oanix-folder-color', color)
  })
}

function applyIcon(folderId: string, icon: string) {
  folderElements(folderId).forEach((element) => {
    element
      .querySelectorAll<HTMLElement>('.oanix-folder-rail__shape')
      .forEach((shape) => { shape.dataset.oanixFolderIcon = icon })
  })
}

function defaultIconForIndex(index: number): FolderIcon | string {
  return FOLDER_DEFAULT_ICONS[index % FOLDER_DEFAULT_ICONS.length] ?? DEFAULT_FOLDER_ICON
}

export function FolderAppearanceRuntime() {
  useEffect(() => {
    let disposed = false
    let lastFolderId = ''
    let colors = new Map<string, string>()
    let icons = new Map<string, FolderIcon>()

    const paintFolders = () => {
      const railItems = Array.from(document.querySelectorAll<HTMLElement>(
        '.oanix-folder-rail__item[data-oanix-folder-id]',
      ))

      railItems.forEach((item, index) => {
        const folderId = item.dataset.oanixFolderId
        if (!folderId) return
        applyColor(folderId, colors.get(folderId) ?? DEFAULT_FOLDER_COLOR)
        applyIcon(folderId, icons.get(folderId) ?? defaultIconForIndex(index))
      })

      document.querySelectorAll<HTMLElement>('.oanix-folder-focus[data-oanix-folder-id]').forEach((panel) => {
        const folderId = panel.dataset.oanixFolderId
        if (!folderId) return
        applyColor(folderId, colors.get(folderId) ?? DEFAULT_FOLDER_COLOR)
      })
    }

    const decorateCustomizer = () => {
      const modal = document.querySelector<HTMLElement>('.oanix-folder-customizer')
      if (!modal || modal.querySelector('.oanix-folder-appearance-picker') || !lastFolderId) return

      const actions = modal.querySelector<HTMLElement>('.oanix-folder-customizer__actions')
      if (!actions) return

      const appearance = document.createElement('div')
      appearance.className = 'oanix-folder-appearance-picker'

      const colorSection = document.createElement('section')
      colorSection.className = 'oanix-folder-appearance-section'

      const colorHeading = document.createElement('div')
      colorHeading.className = 'oanix-folder-appearance-picker__heading'
      colorHeading.innerHTML = '<strong>Color de carpeta</strong><small>Elige un tono o usa un color personalizado.</small>'

      const colorRow = document.createElement('div')
      colorRow.className = 'oanix-folder-appearance-picker__row'

      FOLDER_COLOR_PRESETS.forEach((color) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'oanix-folder-appearance-picker__swatch'
        button.style.setProperty('--oanix-folder-swatch', color)
        button.setAttribute('aria-label', `Usar color ${color}`)
        button.title = color
        button.addEventListener('click', () => {
          void saveFolderColor(lastFolderId, color).then(() => {
            colors.set(lastFolderId, color)
            applyColor(lastFolderId, color)
          })
        })
        colorRow.appendChild(button)
      })

      const customColor = document.createElement('input')
      customColor.type = 'color'
      customColor.className = 'oanix-folder-appearance-picker__custom'
      customColor.value = colors.get(lastFolderId) ?? DEFAULT_FOLDER_COLOR
      customColor.setAttribute('aria-label', 'Elegir color personalizado')
      customColor.addEventListener('input', () => applyColor(lastFolderId, customColor.value))
      customColor.addEventListener('change', () => {
        const value = customColor.value.toLowerCase()
        void saveFolderColor(lastFolderId, value).then(() => {
          colors.set(lastFolderId, value)
          applyColor(lastFolderId, value)
        })
      })
      colorRow.appendChild(customColor)

      const resetColor = document.createElement('button')
      resetColor.type = 'button'
      resetColor.className = 'oanix-folder-appearance-picker__reset'
      resetColor.textContent = 'Restablecer color'
      resetColor.addEventListener('click', () => {
        void removeFolderColor(lastFolderId).then(() => {
          colors.delete(lastFolderId)
          applyColor(lastFolderId, DEFAULT_FOLDER_COLOR)
          customColor.value = DEFAULT_FOLDER_COLOR
        })
      })

      colorSection.append(colorHeading, colorRow, resetColor)

      const iconSection = document.createElement('section')
      iconSection.className = 'oanix-folder-appearance-section oanix-folder-appearance-section--icons'

      const iconHeading = document.createElement('div')
      iconHeading.className = 'oanix-folder-appearance-picker__heading'
      iconHeading.innerHTML = '<strong>Icono de carpeta</strong><small>Iconos compatibles con web y Android, sin espacios vacíos.</small>'

      const iconGrid = document.createElement('div')
      iconGrid.className = 'oanix-folder-appearance-picker__icons'

      FOLDER_ICON_OPTIONS.forEach((icon) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'oanix-folder-appearance-picker__icon'
        button.textContent = icon
        button.setAttribute('aria-label', `Usar icono ${icon}`)
        button.title = `Icono ${icon}`
        if (icons.get(lastFolderId) === icon) button.dataset.selected = 'true'
        button.addEventListener('click', () => {
          void saveFolderIcon(lastFolderId, icon).then(() => {
            icons.set(lastFolderId, icon)
            applyIcon(lastFolderId, icon)
            iconGrid.querySelectorAll<HTMLElement>('[data-selected]').forEach((item) => {
              delete item.dataset.selected
            })
            button.dataset.selected = 'true'
          })
        })
        iconGrid.appendChild(button)
      })

      const resetIcon = document.createElement('button')
      resetIcon.type = 'button'
      resetIcon.className = 'oanix-folder-appearance-picker__reset'
      resetIcon.textContent = 'Restablecer icono'
      resetIcon.addEventListener('click', () => {
        void removeFolderIcon(lastFolderId).then(() => {
          icons.delete(lastFolderId)
          const railItems = Array.from(document.querySelectorAll<HTMLElement>(
            '.oanix-folder-rail__item[data-oanix-folder-id]',
          ))
          const index = Math.max(0, railItems.findIndex((item) => item.dataset.oanixFolderId === lastFolderId))
          applyIcon(lastFolderId, defaultIconForIndex(index))
          iconGrid.querySelectorAll<HTMLElement>('[data-selected]').forEach((item) => {
            delete item.dataset.selected
          })
        })
      })

      iconSection.append(iconHeading, iconGrid, resetIcon)
      appearance.append(colorSection, iconSection)
      actions.before(appearance)
    }

    const captureCustomizeTarget = (event: Event) => {
      const target = event.target as Element | null
      const container = target?.closest<HTMLElement>('[data-oanix-folder-id]')
      const customizeTrigger = target?.closest(
        '.oanix-folder-card__menu, .oanix-folder-focus__menu, [data-oanix-folder-customize]',
      )
      if (container && customizeTrigger) lastFolderId = container.dataset.oanixFolderId ?? ''
    }

    const observer = new MutationObserver(() => {
      paintFolders()
      decorateCustomizer()
    })

    document.addEventListener('pointerdown', captureCustomizeTarget, true)
    observer.observe(document.body, { childList: true, subtree: true })

    void Promise.all([loadFolderColors(), loadFolderIcons()]).then(([loadedColors, loadedIcons]) => {
      if (disposed) return
      colors = loadedColors
      icons = loadedIcons
      paintFolders()
    })

    return () => {
      disposed = true
      document.removeEventListener('pointerdown', captureCustomizeTarget, true)
      observer.disconnect()
    }
  }, [])

  return null
}
