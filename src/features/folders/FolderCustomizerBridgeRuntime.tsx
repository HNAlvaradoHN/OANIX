import { useEffect } from 'react'

const MANAGE_FOLDER_ATTR = 'data-oanix-manage-folder-id'
const MANAGE_FOLDER_NAME_ATTR = 'data-oanix-manage-folder-name'

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  })
}

async function waitForButton(selector: string, attempts = 24): Promise<HTMLButtonElement | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const button = document.querySelector<HTMLButtonElement>(selector)
    if (button) return button
    await new Promise<void>((resolve) => window.setTimeout(resolve, 30))
  }
  return null
}

async function openUnifiedFolderCustomizer(folderId: string) {
  const item = document.querySelector<HTMLButtonElement>(
    `.oanix-folder-rail__item[data-oanix-folder-id="${CSS.escape(folderId)}"]`,
  )
  if (!item) return

  if (!item.classList.contains('is-selected')) {
    item.click()
    await nextFrame()
  }

  const menu = await waitForButton(
    `.oanix-folder-focus[data-oanix-folder-id="${CSS.escape(folderId)}"] .oanix-folder-focus__menu`,
  )
  menu?.click()
}

function activeManageFolder(): { id: string; name: string } | null {
  const root = document.documentElement
  const id = root.getAttribute(MANAGE_FOLDER_ATTR)
  const name = root.getAttribute(MANAGE_FOLDER_NAME_ATTR)
  return id && name ? { id, name } : null
}

function clearManageFolder() {
  const root = document.documentElement
  root.removeAttribute(MANAGE_FOLDER_ATTR)
  root.removeAttribute(MANAGE_FOLDER_NAME_ATTR)
}

function markManageFolder(folderId: string, folderName: string) {
  const root = document.documentElement
  root.setAttribute(MANAGE_FOLDER_ATTR, folderId)
  root.setAttribute(MANAGE_FOLDER_NAME_ATTR, folderName)
}

function isolateLegacyFolderManager() {
  const managed = activeManageFolder()
  if (!managed) return

  const panel = document.querySelector<HTMLElement>(
    '.folder-dialog__panel[aria-label="Administrar carpetas"]',
  )
  if (!panel) return

  panel.dataset.oanixSingleFolderManager = managed.id
  panel.querySelector<HTMLElement>('.folder-create-row')?.setAttribute('hidden', '')

  const heading = panel.querySelector<HTMLElement>('.folder-dialog__header > div')
  if (heading) {
    const title = heading.querySelector<HTMLElement>('strong')
    const subtitle = heading.querySelector<HTMLElement>('span')
    if (title) title.textContent = managed.name
    if (subtitle) subtitle.textContent = 'Administrar nombre o eliminar esta carpeta'
  }

  const rows = Array.from(panel.querySelectorAll<HTMLElement>('.folder-list__row'))
  let target = rows.find((row) => row.dataset.oanixManagedFolderId === managed.id) ?? null

  if (!target) {
    target = rows.find((row) => {
      const renameInput = row.querySelector<HTMLInputElement>('.folder-list__rename')
      if (renameInput?.value.trim() === managed.name) return true
      return row.textContent?.includes(managed.name) === true
    }) ?? null
    if (target) target.dataset.oanixManagedFolderId = managed.id
  }

  rows.forEach((row) => {
    row.hidden = row !== target
  })
}

export function FolderCustomizerBridgeRuntime() {
  useEffect(() => {
    let clearManageTimer: number | null = null

    const scheduleManageCleanup = () => {
      if (clearManageTimer !== null) window.clearTimeout(clearManageTimer)
      clearManageTimer = window.setTimeout(() => {
        clearManageTimer = null
        if (!document.querySelector('.folder-dialog__panel[aria-label="Administrar carpetas"]')) {
          clearManageFolder()
        }
      }, 400)
    }

    const interceptFolderActions = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const gear = target.closest<HTMLElement>('.oanix-folder-card__gear')
      if (gear) {
        const item = gear.closest<HTMLElement>('.oanix-folder-rail__item[data-oanix-folder-id]')
        const folderId = item?.dataset.oanixFolderId
        if (!folderId) return

        event.preventDefault()
        event.stopPropagation()
        if ('stopImmediatePropagation' in event) event.stopImmediatePropagation()

        if (event.type === 'click') void openUnifiedFolderCustomizer(folderId)
        return
      }

      if (event.type !== 'click') return
      const managerButton = target.closest<HTMLButtonElement>('.oanix-folder-customizer__actions button')
      if (!managerButton?.textContent?.includes('Administrar nombre')) return

      const customizer = managerButton.closest<HTMLElement>('.oanix-folder-customizer[data-oanix-folder-id]')
      const folderId = customizer?.dataset.oanixFolderId
      if (!folderId) return

      const item = document.querySelector<HTMLElement>(
        `.oanix-folder-rail__item[data-oanix-folder-id="${CSS.escape(folderId)}"]`,
      )
      const folderName = item?.title.trim() || folderId
      markManageFolder(folderId, folderName)
      scheduleManageCleanup()
    }

    const managerObserver = new MutationObserver(() => {
      isolateLegacyFolderManager()
      if (!document.querySelector('.folder-dialog__panel[aria-label="Administrar carpetas"]')) {
        scheduleManageCleanup()
      }
    })

    document.addEventListener('pointerdown', interceptFolderActions, true)
    document.addEventListener('click', interceptFolderActions, true)
    managerObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.removeEventListener('pointerdown', interceptFolderActions, true)
      document.removeEventListener('click', interceptFolderActions, true)
      managerObserver.disconnect()
      if (clearManageTimer !== null) window.clearTimeout(clearManageTimer)
      clearManageFolder()
    }
  }, [])

  return null
}
