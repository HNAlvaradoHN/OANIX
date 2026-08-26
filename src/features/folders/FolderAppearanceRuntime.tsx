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
  saveFolderColor,
  saveFolderIcon,
} from './folderAppearanceService'

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

function defaultIconForIndex(index: number): FolderIcon {
  return (FOLDER_DEFAULT_ICONS[index % FOLDER_DEFAULT_ICONS.length] ?? DEFAULT_FOLDER_ICON) as FolderIcon
}

function directActionButtons(actions: HTMLElement): HTMLButtonElement[] {
  return Array.from(actions.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
}

function closeCustomizerFromBackdrop() {
  const backdrop = document.querySelector<HTMLElement>('.oanix-folder-customizer-backdrop')
  if (!backdrop) return false
  backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }))
  return true
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

      const railItems = Array.from(document.querySelectorAll<HTMLElement>(
        '.oanix-folder-rail__item[data-oanix-folder-id]',
      ))
      const railIndex = Math.max(0, railItems.findIndex((item) => item.dataset.oanixFolderId === lastFolderId))
      let draftColor = colors.get(lastFolderId) ?? DEFAULT_FOLDER_COLOR
      let draftIcon = icons.get(lastFolderId) ?? defaultIconForIndex(railIndex)

      const appearance = document.createElement('div')
      appearance.className = 'oanix-folder-appearance-picker'
      appearance.hidden = true

      const colorSection = document.createElement('section')
      colorSection.className = 'oanix-folder-appearance-section'

      const colorHeading = document.createElement('div')
      colorHeading.className = 'oanix-folder-appearance-picker__heading'
      colorHeading.innerHTML = '<strong>Color de carpeta</strong><small>Previsualiza el tono y guarda una sola vez al terminar.</small>'

      const colorRow = document.createElement('div')
      colorRow.className = 'oanix-folder-appearance-picker__row'
      const colorButtons: Array<{ button: HTMLButtonElement; color: string }> = []

      const syncColorSelection = (selectedColor: string) => {
        colorButtons.forEach(({ button, color }) => {
          if (selectedColor.toLowerCase() === color.toLowerCase()) button.dataset.selected = 'true'
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
          draftColor = color
          applyColor(lastFolderId, draftColor)
          customColor.value = draftColor
          syncColorSelection(draftColor)
        })
        colorButtons.push({ button, color })
        colorRow.appendChild(button)
      })

      const customColor = document.createElement('input')
      customColor.type = 'color'
      customColor.className = 'oanix-folder-appearance-picker__custom'
      customColor.value = draftColor
      customColor.setAttribute('aria-label', 'Elegir color personalizado')
      customColor.addEventListener('input', () => {
        draftColor = customColor.value.toLowerCase()
        applyColor(lastFolderId, draftColor)
        syncColorSelection(draftColor)
      })
      colorRow.appendChild(customColor)
      syncColorSelection(draftColor)
      colorSection.append(colorHeading, colorRow)

      const iconSection = document.createElement('section')
      iconSection.className = 'oanix-folder-appearance-section oanix-folder-appearance-section--icons'

      const iconHeading = document.createElement('div')
      iconHeading.className = 'oanix-folder-appearance-picker__heading'
      iconHeading.innerHTML = '<strong>Icono de carpeta</strong><small>Elige el icono y confirma junto con el color.</small>'

      const iconGrid = document.createElement('div')
      iconGrid.className = 'oanix-folder-appearance-picker__icons'
      const syncIconSelection = () => {
        iconGrid.querySelectorAll<HTMLButtonElement>('.oanix-folder-appearance-picker__icon').forEach((button) => {
          if (button.dataset.oanixFolderIcon === draftIcon) button.dataset.selected = 'true'
          else delete button.dataset.selected
        })
      }

      FOLDER_ICON_OPTIONS.forEach((icon) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'oanix-folder-appearance-picker__icon'
        button.textContent = icon
        button.dataset.oanixFolderIcon = icon
        button.setAttribute('aria-label', `Usar icono ${icon}`)
        button.title = `Icono ${icon}`
        button.addEventListener('click', () => {
          draftIcon = icon
          applyIcon(lastFolderId, draftIcon)
          syncIconSelection()
        })
        iconGrid.appendChild(button)
      })
      syncIconSelection()
      iconSection.append(iconHeading, iconGrid)

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
        cancelButton.addEventListener('click', () => {
          applyColor(lastFolderId, colors.get(lastFolderId) ?? DEFAULT_FOLDER_COLOR)
          applyIcon(lastFolderId, icons.get(lastFolderId) ?? defaultIconForIndex(railIndex))
        })
      }

      const resetDraftFromSaved = () => {
        draftColor = colors.get(lastFolderId) ?? DEFAULT_FOLDER_COLOR
        draftIcon = icons.get(lastFolderId) ?? defaultIconForIndex(railIndex)
        customColor.value = draftColor
        syncColorSelection(draftColor)
        syncIconSelection()
        applyColor(lastFolderId, draftColor)
        applyIcon(lastFolderId, draftIcon)
      }

      const saveAppearance = document.createElement('button')
      saveAppearance.type = 'button'
      saveAppearance.className = 'oanix-folder-appearance-picker__save'
      saveAppearance.textContent = 'Guardar'
      saveAppearance.addEventListener('click', () => {
        if (saveAppearance.disabled) return
        saveAppearance.disabled = true
        saveAppearance.textContent = 'Guardando…'
        void Promise.all([
          saveFolderColor(lastFolderId, draftColor),
          saveFolderIcon(lastFolderId, draftIcon),
        ]).then(() => {
          colors.set(lastFolderId, draftColor)
          icons.set(lastFolderId, draftIcon)
          applyColor(lastFolderId, draftColor)
          applyIcon(lastFolderId, draftIcon)
          saveAppearance.textContent = '✓ Guardado'
          saveAppearance.disabled = true
          window.setTimeout(() => {
            if (!closeCustomizerFromBackdrop()) cancelButton?.click()
            window.setTimeout(() => {
              if (document.querySelector<HTMLElement>('.oanix-folder-customizer')) {
                cancelButton?.click()
              }
            }, 150)
          }, 450)
        }).catch(() => {
          saveAppearance.textContent = 'Reintentar guardar'
          saveAppearance.disabled = false
        })
      })

      appearance.append(colorSection, iconSection, saveAppearance)
      actions.before(appearance)

      const appearanceButton = document.createElement('button')
      appearanceButton.type = 'button'
      appearanceButton.className = 'oanix-folder-customizer__appearance-toggle'
      appearanceButton.textContent = '🎨 Cambiar color / Icono'
      appearanceButton.setAttribute('aria-expanded', 'false')
      appearanceButton.addEventListener('click', () => {
        resetDraftFromSaved()
        appearance.hidden = false
        actions.hidden = true
        modal.dataset.oanixAppearanceOnly = 'true'
        appearanceButton.setAttribute('aria-expanded', 'true')
        appearance.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })

      actions.prepend(appearanceButton)
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

    let gridObserver: MutationObserver | null = null
    let observedGrid: HTMLElement | null = null

    const bindGridObserver = () => {
      const nextGrid = document.querySelector<HTMLElement>('.oanix-folder-grid')
      if (nextGrid === observedGrid) return

      gridObserver?.disconnect()
      observedGrid = nextGrid
      if (!observedGrid) {
        gridObserver = null
        return
      }

      gridObserver = new MutationObserver(paintFolders)
      gridObserver.observe(observedGrid, { childList: true, subtree: true })
    }

    const bodyObserver = new MutationObserver(() => {
      bindGridObserver()
      paintFolders()
      decorateCustomizer()
    })

    document.addEventListener('pointerdown', captureCustomizeTarget, true)
    bindGridObserver()
    paintFolders()
    decorateCustomizer()
    bodyObserver.observe(document.body, { childList: true })

    void Promise.all([loadFolderColors(), loadFolderIcons()]).then(([loadedColors, loadedIcons]) => {
      if (disposed) return
      colors = loadedColors
      icons = loadedIcons
      paintFolders()
    })

    return () => {
      disposed = true
      document.removeEventListener('pointerdown', captureCustomizeTarget, true)
      bodyObserver.disconnect()
      gridObserver?.disconnect()
    }
  }, [])

  return null
}
