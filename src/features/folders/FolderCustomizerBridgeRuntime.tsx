import { useEffect } from 'react'

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

export function FolderCustomizerBridgeRuntime() {
  useEffect(() => {
    const interceptGear = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const gear = target.closest<HTMLElement>('.oanix-folder-card__gear')
      if (!gear) return

      const item = gear.closest<HTMLElement>('.oanix-folder-rail__item[data-oanix-folder-id]')
      const folderId = item?.dataset.oanixFolderId
      if (!folderId) return

      event.preventDefault()
      event.stopPropagation()
      if ('stopImmediatePropagation' in event) event.stopImmediatePropagation()

      if (event.type === 'click') void openUnifiedFolderCustomizer(folderId)
    }

    document.addEventListener('pointerdown', interceptGear, true)
    document.addEventListener('click', interceptGear, true)

    return () => {
      document.removeEventListener('pointerdown', interceptGear, true)
      document.removeEventListener('click', interceptGear, true)
    }
  }, [])

  return null
}
