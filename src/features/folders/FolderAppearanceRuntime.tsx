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
import './folderFullWorkspace.css'

function folderElements(folderId: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(
    `[data-oanix-folder-id="${CSS.escape(folderId)}"]`,
  ))
}

function applyColor(folderId: string, color: string) {
  folderElements(folderId).forEach((element) => {
    if (element.style.getPropertyValue('--oanix-folder-color') !== color) {
      element.style.setProperty('--oanix-folder-color', color)
    }
  })
}

function applyIcon(folderId: string, icon: string) {
  folderElements(folderId).forEach((element) => {
    element
      .querySelectorAll<HTMLElement>('.oanix-folder-rail__shape')
      .forEach((shape) => {
        if (shape.dataset.oanixFolderIcon !== icon) shape.dataset.oanixFolderIcon = icon
      })

    element
      .querySelectorAll<HTMLElement>('.oanix-folder-customizer__preview > span')
      .forEach((preview) => {
        if (preview.textContent !== icon) preview.textContent = icon
      })
  })
}

function defaultIconForIndex(index: number): FolderIcon | string {
  return FOLDER_DEFAULT_ICONS[index % FOLDER_DEFAULT_ICONS.length] ?? DEFAULT_FOLDER_ICON
}

function directActionButtons(actions: HTMLElement): HTMLButtonElement[] {
  return Array.from(actions.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
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

      const customizer = document.querySelector<HTMLElement>('.oanix-folder-customizer[data-oanix-folder-id]')
      const customizerId = customizer?.dataset.oanixFolderId
      if (customizer && customizerId) {
        applyColor(customizerId, colors.get(customizerId) ?? DEFAULT_FOLDER_COLOR)
        const railIndex = Math.max(0, railItems.findIndex((item) => item.dataset.oanixFolderId === customizerId))
        applyIcon(customizerId, icons.get(customizerId) ?? defaultIconForIndex(railIndex))
      }
    }

    const decorateCustomizer = () => {
      const modal = document.querySelector<HTMLElement>('.oanix-folder-customizer')
      if (!modal || modal.querySelector('.oanix-folder-appearance-picker')) return

      const modalFolderId = modal.dataset.oanixFolderId
      if (modalFolderId) lastFolderId = modalFolderId
      if (!lastFolderId) return

      const actions = modal.querySelector<HTMLElement>('.oanix-folder-customizer__actions')
      if (!actions) return

      const appearance = document.createElement('div')
      appearance.className = 'oanix-folder-appearance-picker'
      appearance.hidden = true

      const colorSection = document.createElement('section')
      colorSection.className = 'oanix-folder-appearance-section'

      const colorHeading = document.createElement('div')
      colorHeading.className = 'oanix-folder-appearance-picker__heading'
      colorHeading.innerHTML = '<strong>Color de carpeta</strong><small>Elige un tono o usa un color personalizado.</small>'

      const colorRow = document.createElement('div')
      colorRow.className = 'oanix-folder-appearance-picker__row'
      const colorButtons: Array<{ button: HTMLButtonElement; color: string }> = []

      const syncColorSelection = (selectedColor: string | undefined) => {
        colorButtons.forEach(({ button, color }) => {
          if (selectedColor?.toLowerCase() === color.toLowerCase()) button.dataset.selected = 'true'
          else delete button.dataset.selected
        })
      }

      FOLDER_COLOR_PRESETS.forEach((color) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'oanix-folder-appearance-picker__swatch'
        button.style.setProperty('--oanix-folder-swatch', color)
        button.style.backgroundColor = color
        button.setAttribute('aria-label', `Usar color ${color}`)
        button.title = color
        button.addEventListener('click', () => {
          void saveFolderColor(lastFolderId, color).then(() => {
            colors.set(lastFolderId, color)
            applyColor(lastFolderId, color)
            customColor.value = color
            syncColorSelection(color)
          })
        })
        colorButtons.push({ button, color })
        colorRow.appendChild(button)
      })

      const customColor = document.createElement('input')
      customColor.type = 'color'
      customColor.className = 'oanix-folder-appearance-picker__custom'
      customColor.value = colors.get(lastFolderId) ?? DEFAULT_FOLDER_COLOR
      customColor.setAttribute('aria-label', 'Elegir color personalizado')
      customColor.addEventListener('input', () => {
        applyColor(lastFolderId, customColor.value)
        syncColorSelection(customColor.value)
      })
      customColor.addEventListener('change', () => {
        const value = customColor.value.toLowerCase()
        void saveFolderColor(lastFolderId, value).then(() => {
          colors.set(lastFolderId, value)
          applyColor(lastFolderId, value)
          syncColorSelection(value)
        })
      })
      colorRow.appendChild(customColor)
      syncColorSelection(colors.get(lastFolderId) ?? DEFAULT_FOLDER_COLOR)

      const resetColor = document.createElement('button')
      resetColor.type = 'button'
      resetColor.className = 'oanix-folder-appearance-picker__reset'
      resetColor.textContent = 'Restablecer color'
      resetColor.addEventListener('click', () => {
        void removeFolderColor(lastFolderId).then(() => {
          colors.delete(lastFolderId)
          applyColor(lastFolderId, DEFAULT_FOLDER_COLOR)
          customColor.value = DEFAULT_FOLDER_COLOR
          syncColorSelection(DEFAULT_FOLDER_COLOR)
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

      const existingActions = directActionButtons(actions)
      const imageButton = existingActions[0]
      const removeImageButton = existingActions.find((button) => button.classList.contains('oanix-folder-customizer__remove'))
      const managerButton = existingActions.find((button) => button.textContent?.includes('Administrar nombre'))
      const cancelButton = existingActions[existingActions.length - 1]

      if (imageButton) {
        imageButton.textContent = imageButton.textContent?.includes('Poner')
          ? '🖼️ Poner imagen desde mi dispositivo'
          : '🖼️ Cambiar imagen de mi dispositivo'
        imageButton.classList.add('oanix-folder-customizer__image-action')
      }
      if (removeImageButton) removeImageButton.textContent = '🧹 Quitar imagen'
      if (managerButton) managerButton.textContent = '✏️ Administrar nombre / eliminar'
      if (cancelButton) {
        cancelButton.textContent = 'Cancelar'
        cancelButton.classList.add('oanix-folder-customizer__cancel-action')
      }

      const openButton = document.createElement('button')
      openButton.type = 'button'
      openButton.className = 'oanix-folder-customizer__open-action'
      openButton.textContent = '📂 Abrir carpeta'
      openButton.addEventListener('click', () => {
        const folderId = lastFolderId
        cancelButton?.click()
        window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(`.oanix-folder-focus[data-oanix-folder-id="${CSS.escape(folderId)}"]`)
            ?.querySelector<HTMLButtonElement>('.oanix-folder-focus__open')
            ?.click()
        })
      })

      const appearanceButton = document.createElement('button')
      appearanceButton.type = 'button'
      appearanceButton.className = 'oanix-folder-customizer__appearance-toggle'
      appearanceButton.textContent = '🎨 Cambiar color / Icono'
      appearanceButton.setAttribute('aria-expanded', 'false')
      appearanceButton.addEventListener('click', () => {
        appearance.hidden = !appearance.hidden
        appearanceButton.setAttribute('aria-expanded', appearance.hidden ? 'false' : 'true')
        appearanceButton.textContent = appearance.hidden ? '🎨 Cambiar color / Icono' : '✓ Cerrar color / Icono'
        if (!appearance.hidden) appearance.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })

      actions.prepend(appearanceButton)
      actions.prepend(openButton)
      paintFolders()
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
